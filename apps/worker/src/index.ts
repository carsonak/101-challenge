/**
 * @file Runs the worker queue connection and HTTP health service.
 * Use `pnpm dev:worker` during development or `pnpm start:worker` after building.
 * The commands load the root .env. When DATABASE_URL is configured, startup can
 * create queue tables and requires applied tracker migrations and database access. Without it, liveness
 * remains available but readiness returns 503. The listener uses WORKER_HOST and
 * WORKER_PORT; startup failures are reported with a nonzero exit status.
 * Opens long-lived connections and a listener, logs status/errors, and closes
 * resources on SIGINT or SIGTERM, with a ten-second shutdown deadline.
 * Runs immediately when executed or imported.
 */

import { createServer } from "node:http";
import { parseServerConfig } from "@challenge/contracts";
import { readiness } from "@challenge/core";
import { createJobStore } from "@challenge/db";
import { startJobs } from "./jobs.js";
import { PgBoss } from "pg-boss";

/** Start the configured queue connection and HTTP health listener. */
async function main() {
  const config = parseServerConfig(process.env);
  const database = config.DATABASE_URL
    ? createJobStore(config.DATABASE_URL)
    : undefined;
  const boss = config.DATABASE_URL
    ? new PgBoss({
        connectionString: config.DATABASE_URL,
        schema: config.QUEUE_SCHEMA,
      })
    : undefined;
  boss?.on("error", () => console.error("Worker queue unavailable"));
  let stopJobs: (() => Promise<void>) | undefined;
  const server = createServer(async (request, response) => {
    if (
      request.method !== "GET" ||
      !["/health", "/ready"].includes(request.url ?? "")
    ) {
      response.writeHead(404).end();
      return;
    }
    const result =
      request.url === "/health"
        ? { status: "ok", service: "worker" }
        : await readiness("worker", async () => {
            if (!database || !boss) throw new Error("Database not configured");
            await database.ready();
          });
    response.writeHead(result.status === "ok" ? 200 : 503, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify(result));
  });
  let stopping = false;
  let startup: Promise<void> | undefined;
  /** Close the listener and service connections once; exit unsuccessfully if cleanup exceeds its deadline. */
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    await startup?.catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await stopJobs?.();
    await boss?.stop();
    await database?.close();
    clearTimeout(deadline);
  }
  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.once("SIGINT", () => {
    void shutdown();
  });
  server.once("error", () => {
    console.error("Worker listener failed");
    void shutdown().then(() => {
      process.exitCode = 1;
    });
  });
  // Signal/listener cleanup exists before any handlers are registered.
  startup = (async () => {
    await database?.ready();
    if (stopping) return;
    await boss?.start();
    if (stopping) return;
    if (database && boss) stopJobs = await startJobs(boss, database);
  })();
  try {
    await startup;
  } catch {
    await shutdown();
    throw new Error("Worker queue startup failed");
  }
  if (!stopping) {
    server.listen(config.WORKER_PORT, config.WORKER_HOST, () =>
      console.info("Worker listening")
    );
  }
}

main().catch(() => {
  console.error(
    "Worker startup failed; check server configuration and database availability"
  );
  process.exitCode = 1;
});
