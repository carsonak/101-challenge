import type { Report, Tables, Transaction } from "@challenge/core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { decode, encode, encoding } from "./encoding.js";
/** Create a Drizzle-backed transaction port for one PostgreSQL connection. */
export function transactionPort(client: pg.PoolClient): Transaction {
  const db = drizzle(client);
  /** Keep structured report values under relational cross-attempt constraints. */
  async function reportValues(row: Report) {
    await db.execute(
      sql`DELETE FROM report_goal_values WHERE report_id=${row.id}`
    );

    for (const value of row.goalValues)
      await db.execute(
        sql`INSERT INTO report_goal_values(report_id,attempt_id,goal_revision_id,value) VALUES(${row.id},${row.attemptId},${value.goalRevisionId},${value.value})`
      );
  }

  return {
    async reportSummary(attemptId, date) {
      const metadata = await client.query(
        'SELECT "reportingDate"::text,"streakAtReport" FROM reports WHERE "attemptId"=$1 ORDER BY "reportingDate"',
        [attemptId]
      );

      const current = await client.query(
        'SELECT * FROM reports WHERE "attemptId"=$1 AND "reportingDate"=$2',
        [attemptId, date]
      );

      return {
        dates: metadata.rows as {
          reportingDate: string;
          streakAtReport: number;
        }[],
        today: current.rows[0] ? decode("reports", current.rows[0]) : undefined,
      };
    },
    async eraseAttempt(userId, attemptId) {
      await db.execute(
        sql`SELECT erase_cancelled_attempt(${userId},${attemptId})`
      );
    },
    async get<K extends keyof Tables>(table: K, id: string, lock = false) {
      const result = await db.execute(
        sql`SELECT * FROM ${sql.identifier(table)} WHERE id=${id} ${lock ? sql`FOR UPDATE` : sql``}`
      );

      return result.rows[0] ? decode(table, result.rows[0]) : undefined;
    },
    async list<K extends keyof Tables>(table: K, where: Partial<Tables[K]>) {
      const conditions = Object.entries(where).map(([key, value]) => {
        encoding(table, key);
        return value === null
          ? sql`${sql.identifier(key)} IS NULL`
          : sql`${sql.identifier(key)}=${encode(table, key, value)}`;
      });

      const result = await db.execute(
        sql`SELECT * FROM ${sql.identifier(table)} ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``} ORDER BY id`
      );

      return result.rows.map((row) => decode(table, row));
    },
    async insert<K extends keyof Tables>(table: K, row: Tables[K]) {
      const entries = Object.entries(row);
      for (const [key] of entries) encoding(table, key);

      await db.execute(
        sql`INSERT INTO ${sql.identifier(table)} (${sql.join(
          entries.map(([key]) => sql.identifier(key)),
          sql`, `
        )}) VALUES (${sql.join(
          entries.map(([key, value]) => sql`${encode(table, key, value)}`),
          sql`, `
        )})`
      );

      if (table === "reports") await reportValues(row as Report);
    },
    async save<K extends keyof Tables>(table: K, row: Tables[K]) {
      if (
        table === "entitlements" ||
        table === "goal_revisions" ||
        table === "milestone_revisions"
      )
        throw new Error("Immutable repository record");

      const assignments = Object.entries(row)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => {
          encoding(table, key);
          return sql`${sql.identifier(key)}=${encode(table, key, value)}`;
        });

      const result = await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.join(assignments, sql`, `)} WHERE id=${row.id}`
      );

      if (result.rowCount !== 1) throw new Error("Missing repository record");

      if (table === "reports") await reportValues(row as Report);
    },
    async serializeKey(key) {
      await db.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},101))`
      );
    },
    async remove(table, id) {
      await db.execute(
        sql`DELETE FROM ${sql.identifier(table)} WHERE id=${id}`
      );
    },
  };
}
