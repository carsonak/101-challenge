/**
 * @file Run a sleeping worker HTTP service or one bounded sweep (--once).
 * Resident mode owns timers; request mode requires external durable scheduling.
 * Opens lazy restricted connections, never pg-boss polling or migration DDL.
 */
import { parseServerConfig } from "@challenge/contracts";
import { logBackend, createWorkLoop } from "@challenge/core";
import { createJobStore } from "@challenge/db";
import { startJobs } from "./jobs.js";
import { serveWorker } from "./service.js";

/** Start the service with scoped credentials and release resources on termination. */
async function main() {
  const config = parseServerConfig(process.env);
  const database = config.DATABASE_URL
    ? createJobStore(config.DATABASE_URL)
    : undefined;

  const once = process.argv.includes("--once");
  if (!once && config.WORK_MODE === "request" && !config.WORKER_WAKE_SECRET)
    throw new Error(
      "Request execution requires a private worker wake key and durable scheduler"
    );

  const loop = database
    ? startJobs(database, {
        ...config,
        WORK_MODE: once ? "request" : config.WORK_MODE,
      })
    : createWorkLoop({
        minMs: 2000,
        maxMs: 30000,
        recoveryMinMs: 900000,
        recoveryMaxMs: 3600000,
        resident: false,
        run: async () => {
          throw new Error("Database not configured");
        },
        onError: () => {},
      });

  const ready = async () => {
    if (!database) throw new Error("Database not configured");

    await database.ready();
  };

  if (once) {
    try {
      await ready();
      console.info(
        JSON.stringify({ nextRunAt: new Date(await loop.run()).toISOString() })
      );
    } finally {
      await loop.stop();
      await database?.close();
    }

    return;
  }

  const service = serveWorker({
    service: "worker",
    host: config.WORKER_HOST,
    port: config.WORKER_PORT,
    secret: config.WORKER_WAKE_SECRET,
    resident: Boolean(database) && config.WORK_MODE === "resident",
    loop,
    ready,
    close: async () => {
      await database?.close();
    },
  });

  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 30000).unref();
      void service.close().finally(() => clearTimeout(timeout));
    });

  try {
    if (database && config.WORK_MODE === "resident") await ready();

    await service.start();
    logBackend("worker", "runtime_ready", {
      databaseReady: Boolean(database) && config.WORK_MODE === "resident",
      jobsReady: Boolean(database),
    });

    logBackend("worker", "listening", { port: config.WORKER_PORT });
  } catch (error) {
    await service.close();
    throw error;
  }
}

main().catch((error) => {
  logBackend("worker", "startup_failed", {}, error);
  process.exitCode = 1;
});
