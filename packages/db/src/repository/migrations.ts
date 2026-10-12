import { readFile } from "node:fs/promises";
import type { QueryResult } from "pg";
import type pg from "pg";
import { trackerMigrations } from "../migrations.js";
/** Build migrations operations using the owning repository pool. */
export function createMigrations(context: {
  /** Pool owned and closed by the repository. */ pool: pg.Pool;
  /** Privileged access is unavailable to application-role handles. */ applicationRole: boolean;
  /** Application-role transaction query. */ adapterQuery: (
    text: string,
    values: unknown[]
  ) => Promise<QueryResult>;
}) {
  const { pool, applicationRole } = context;
  return {
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

        for (const [version, file] of trackerMigrations) {
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
                new URL(`../../migrations/${file}`, import.meta.url),
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
  };
}
