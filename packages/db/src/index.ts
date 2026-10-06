import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

/**
 * Create server-side PostgreSQL access for repository queries and connectivity checks.
 * Use the returned `db` client for queries and await `close()` when the handle is
 * no longer needed. Connections open as needed; idle connection failures write a
 * credential-free error to stderr. Queries may read or change database state.
 *
 * @param connectionString PostgreSQL connection URL; keep credentials server-side.
 * @returns A query client with connectivity and cleanup methods.
 */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
  });
  // An idle connection error must not crash a process or print credentials.
  pool.on("error", () => console.error("Database connection unavailable"));
  const db = drizzle(pool);
  return {
    /** Query client for repository reads and writes; release its resources through `close()`. */
    db,
    /**
     * Check connectivity with a read-only database request before declaring readiness.
     * Await completion; rejects if the database cannot respond successfully.
     */
    async probe() {
      const result = await pool.query(
        "SELECT count(*)::int AS count FROM tracker_migrations WHERE version IN(1,2,3,4)"
      );
      if (result.rows[0]?.count !== 4)
        throw new Error("Tracker migrations required");
    },
    /** Release this handle's database connections; await during cleanup and do not reuse afterward. */
    async close() {
      await pool.end();
    },
  };
}

export * from "./repository.js";

export * from "./jobs.js";
