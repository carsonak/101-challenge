import pg from "pg";
import { databaseConfigSchema } from "@challenge/contracts";

/** Create a bounded lazy pool; idle clients are released after ten seconds. The caller owns end(). */
export function createPool(connectionString: string) {
  const parsed = databaseConfigSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Invalid database pool configuration");

  const pool = new pg.Pool({
    connectionString,
    max: parsed.data.DB_POOL_MAX,
    connectionTimeoutMillis: parsed.data.DB_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
  });

  pool.on("error", () => console.error("Database connection unavailable"));
  return pool;
}
