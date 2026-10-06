import pg from "pg";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { columns } from "./columns.js";
import { readFile } from "node:fs/promises";
import type { Repository, Tables, Transaction, Report } from "@challenge/core";

/** Validate repository-owned table/column identifiers and encode private values. */
function encoding(table: keyof Tables, key: string): string {
  const map: Record<string, string> = columns[table];
  const kind = map[key];
  if (!kind) throw new Error("Unknown repository column");
  return kind;
}
/** Convert application values into PostgreSQL wire values without precision loss. */
function encode(table: keyof Tables, key: string, value: unknown): unknown {
  const kind = encoding(table, key).replace("?", "");
  if (value === null) return null;
  if (kind === "json") return JSON.stringify(value);
  if (kind === "seed") return Buffer.from(String(value), "hex");
  return value;
}
/** Decode only typed persistence columns, retaining civil dates as date strings. */
function decode<K extends keyof Tables>(
  table: K,
  raw: Record<string, unknown>
): Tables[K] {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const kind = encoding(table, key).replace("?", "");
    if (value === null) result[key] = null;
    else if (kind === "instant")
      result[key] = new Date(
        value instanceof Date ? value.getTime() : String(value)
      ).toISOString();
    else if (kind === "date" && value instanceof Date)
      result[key] =
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    else result[key] = Buffer.isBuffer(value) ? value.toString("hex") : value;
  }
  return result as unknown as Tables[K];
}
/** Create a Drizzle-backed transaction port for one PostgreSQL connection. */
function transactionPort(client: pg.PoolClient): Transaction {
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
/** PostgreSQL repository with atomic rollback and bounded deadlock/serialization retries. */
export function createRepository(
  connectionString: string,
  applicationRole = false
) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  pool.on("error", () => console.error("Tracker database unavailable"));
  /** Execute adapter metadata access under the same restricted application role. */
  async function adapterQuery(text: string, values: unknown[]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (applicationRole)
        await client.query("SET LOCAL ROLE challenge_tracker_app");
      const result = await client.query(text, values);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const repository: Repository = {
    async transaction<T>(
      callback: (tx: Transaction) => Promise<T>
    ): Promise<T> {
      for (let retry = 0; ; retry++) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          if (applicationRole)
            await client.query("SET LOCAL ROLE challenge_tracker_app");
          const result = await callback(transactionPort(client));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          const failure = (error as { cause?: unknown }).cause ?? error;
          const code = (failure as { code?: string }).code;
          if (retry >= 2 || (code !== "40001" && code !== "40P01"))
            throw failure;
        } finally {
          client.release();
        }
      }
    },
  };
  return {
    /** Transaction owner to inject into the framework-independent tracker service. */
    repository,
    /** Recover the original enrollment version for a duplicate signed resume interaction without reading its private hash. */
    async resumeVersion(userId: string, key: string, enrollmentId: string) {
      const row = (
        await adapterQuery(
          `SELECT version FROM replays WHERE "userId"=$1 AND command='ResumeEnrollment' AND key=$2 AND "resourceId"=$3 AND "expiresAt">now()`,
          [userId, key, enrollmentId]
        )
      ).rows[0];
      return row ? Number(row.version) - 1 : undefined;
    },
    /** Create a ten-minute actor-bound interaction form with resource/version metadata only. */
    async interactionForm(input: {
      userId: string;
      kind: "setup" | "update" | "edit" | "cancel" | "restart";
      resourceId: string;
      version: number;
      enrollmentId: string;
      enrollmentVersion: number;
    }) {
      const id = randomUUID();
      await adapterQuery(
        `INSERT INTO adapter_confirmations VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '10 minutes')`,
        [
          id,
          input.userId,
          input.kind,
          input.resourceId,
          input.version,
          input.enrollmentId,
          input.enrollmentVersion,
        ]
      );
      return id;
    },
    /** Resolve only an unexpired form owned by the authenticated actor; submitted bodies remain transient. */
    async interactionContext(id: string, userId: string) {
      return (
        await adapterQuery(
          'SELECT * FROM adapter_confirmations WHERE id=$1 AND "userId"=$2 AND "expiresAt">now()',
          [id, userId]
        )
      ).rows[0] as
        | {
            id: string;
            kind: "setup" | "update" | "edit" | "cancel" | "restart";
            resourceId: string;
            version: number;
            enrollmentId: string;
            enrollmentVersion: number;
          }
        | undefined;
    },
    /** Apply the initial migration once under a database advisory lock; requires schema ownership. */
    async migrate() {
      if (applicationRole)
        throw Object.assign(new Error("Migration credentials required"), {
          code: "42501",
        });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(101001)");
        await client.query(
          "CREATE TABLE IF NOT EXISTS tracker_migrations(version integer PRIMARY KEY)"
        );
        for (const [version, file] of [
          [1, "0001_tracker.sql"],
          [2, "0002_identity.sql"],
          [3, "0003_adapters.sql"],
          [4, "0004_jobs.sql"],
        ] as const) {
          if (
            !(
              await client.query(
                "SELECT version FROM tracker_migrations WHERE version=$1",
                [version]
              )
            ).rowCount
          ) {
            await client.query(
              await readFile(
                new URL(`../migrations/${file}`, import.meta.url),
                "utf8"
              )
            );
            await client.query("INSERT INTO tracker_migrations VALUES($1)", [
              version,
            ]);
          }
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    /** Execute only an owner-confirmed erasure request using privileged database credentials. */
    async eraseAccount(
      userId: string,
      requestId: string,
      queueSchema?: string
    ) {
      if (applicationRole)
        throw Object.assign(new Error("Erasure credentials required"), {
          code: "42501",
        });
      await pool.query("SELECT erase_tracker_account($1,$2,$3)", [
        userId,
        requestId,
        queueSchema ?? null,
      ]);
    },
    /** Content-free deletion ledger for trusted backup/restore tooling; never expose as an API. */
    async deletionLedger() {
      if (applicationRole)
        throw Object.assign(new Error("Ledger credentials required"), {
          code: "42501",
        });
      return (
        await pool.query(
          'SELECT "userId", "erasedAt" FROM deletion_ledger ORDER BY "userId"'
        )
      ).rows as { userId: string; erasedAt: Date }[];
    },
    /** Replay a trusted content-free deletion ledger after restore, before serving traffic. */
    async replayErasures(userIds: string[], queueSchema?: string) {
      if (applicationRole)
        throw Object.assign(new Error("Restore credentials required"), {
          code: "42501",
        });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const userId of userIds) {
          if (!/^[a-f0-9-]{36}$/.test(userId))
            throw new Error("Invalid deletion ledger");
          if (
            (
              await client.query(
                "SELECT id FROM users WHERE id=$1 FOR UPDATE",
                [userId]
              )
            ).rowCount
          ) {
            const requestId = randomUUID();
            await client.query(
              'INSERT INTO erasure_requests(id,"userId","requestedAt","processedAt") VALUES($1,$2,clock_timestamp(),NULL)',
              [requestId, userId]
            );
            await client.query("SELECT erase_tracker_account($1,$2,$3)", [
              userId,
              requestId,
              queueSchema ?? null,
            ]);
          } else
            await client.query(
              'INSERT INTO deletion_ledger VALUES($1,clock_timestamp()) ON CONFLICT("userId") DO NOTHING',
              [userId]
            );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    /** Read-only database readiness probe. */
    async probe() {
      await pool.query("SELECT 1");
    },
    /** Release all connections; await during shutdown. */
    async close() {
      await pool.end();
    },
  };
}
