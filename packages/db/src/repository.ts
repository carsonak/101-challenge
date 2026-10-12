import type { Repository, Transaction } from "@challenge/core";
import pg from "pg";
import { createMaintenance } from "./repository/maintenance.js";
import { createMetadata } from "./repository/metadata.js";
import { createMigrations } from "./repository/migrations.js";
import { createRestore } from "./repository/restore.js";
import { transactionPort } from "./repository/transaction.js";

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
    ...createMetadata({ pool, adapterQuery, applicationRole }),
    ...createMigrations({ pool, adapterQuery, applicationRole }),
    ...createMaintenance({ pool, adapterQuery, applicationRole }),
    ...createRestore({ pool, adapterQuery, applicationRole }),
    /** Transaction owner to inject into the framework-independent tracker service. */
    repository,
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
