import type { Repository, Transaction } from "@challenge/core";
import { createDatabaseThrottle } from "./rates.js";
import { createPool } from "./pool.js";
import { createMaintenance } from "./repository/maintenance.js";
import { createMetadata } from "./repository/metadata.js";
import { createMigrations } from "./repository/migrations.js";
import { createRestore } from "./repository/restore.js";
import { transactionPort } from "./repository/transaction.js";

/**
 * PostgreSQL repository with atomic rollback and bounded serialization retries.
 * onWorkCommitted is a synchronous scheduling hook, invoked once per affected
 * service only after commit. Hook failures cannot undo or retry a committed write.
 * Callers must retain asynchronous hint delivery through their request lifecycle.
 */
export function createRepository(
  connectionString: string,
  applicationRole = false,
  onWorkCommitted?: (service: "worker" | "maintenance") => void
) {
  const pool = createPool(connectionString);
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

          const work = new Set<"worker" | "maintenance">();
          const result = await callback(
            transactionPort(client, (table) => {
              if (table === "outbox") work.add("worker");

              if (table === "account_mail" || table === "erasure_requests")
                work.add("maintenance");
            })
          );

          await client.query("COMMIT");
          // Wake delivery cannot roll back or retry an already committed command.
          for (const service of work) {
            try {
              onWorkCommitted?.(service);
            } catch {
              /* Recovery sweep discovers durable work. */
            }
          }

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
    /** Shared production throttling, outside domain transactions. */
    rates: createDatabaseThrottle(adapterQuery),
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
