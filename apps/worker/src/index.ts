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
import { readiness, logBackend, type BackendDetails } from "@challenge/core";
import { createJobStore } from "@challenge/db";
import { startJobs } from "./jobs.js";
import { PgBoss } from "pg-boss";

/** Current startup operation, retained for failures before cleanup. */
let startupStage: BackendDetails["stage"] = "configuration";

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
  boss?.on("error", (error) => logBackend("worker", "queue_failed", {}, error));
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
    logBackend("worker", "shutdown_started");
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    await startup?.catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await stopJobs?.();
    await boss?.stop();
    await database?.close();
    clearTimeout(deadline);
    logBackend("worker", "shutdown_complete");
  }
  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.once("SIGINT", () => {
    void shutdown();
  });
  server.once("error", (error) => {
    logBackend("worker", "listener_failed", {}, error);
    void shutdown().then(() => {
      process.exitCode = 1;
    });
  });
  // Signal/listener cleanup exists before any handlers are registered.
  startup = (async () => {
    startupStage = "database_readiness";
    await database?.ready();
    if (stopping) return;
    startupStage = "queue_start";
    await boss?.start();
    if (stopping) return;
    startupStage = "job_registration";
    if (database && boss) stopJobs = await startJobs(boss, database);
  })();
  try {
    await startup;
  } catch (error) {
    logBackend("worker", "startup_failed", { stage: startupStage }, error);
    await shutdown();
    process.exitCode = 1;
    return;
  }
  if (!stopping) {
    server.listen(config.WORKER_PORT, config.WORKER_HOST, () =>
      logBackend("worker", "listening", { port: config.WORKER_PORT })
    );
  }
}

main().catch((error) => {
  logBackend("worker", "startup_failed", { stage: startupStage }, error);
  process.exitCode = 1;
});
