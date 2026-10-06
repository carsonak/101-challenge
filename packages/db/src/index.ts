import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

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
    db,
    async probe() {
      await pool.query("select 1");
    },
    async close() {
      await pool.end();
    },
  };
}
