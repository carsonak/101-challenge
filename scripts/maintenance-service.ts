/** @file Private resident/request-scoped erasure and mail service. No public web credentials or arbitrary job inputs. */
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createWorkLoop, logBackend } from "../packages/core/src/index.js";
import { createRepository } from "@challenge/db";
import { createMailer } from "../apps/web/server/mail.js";
import { serveWorker } from "../apps/worker/src/service.js";

/** Start private maintenance with persistent deadlines; external scheduling is required in request mode. */
async function main() {
  const connection = process.env.ERASURE_DATABASE_URL;
  if (!connection) throw new Error("Maintenance credentials required");

  const config = parseServerConfig(process.env);
  if (config.WORK_MODE === "request" && !config.MAINTENANCE_WAKE_SECRET)
    throw new Error(
      "Request execution requires a private maintenance wake key and durable scheduler"
    );

  const database = createRepository(connection);
  const mail = createMailer(config);
  const loop = createWorkLoop({
    minMs: config.OUTBOX_POLL_MS,
    maxMs: config.OUTBOX_IDLE_MAX_MS,
    recoveryMinMs: config.WORK_RECOVERY_MIN_MS,
    recoveryMaxMs: config.WORK_RECOVERY_MAX_MS,
    resident: config.WORK_MODE === "resident",
    onError: (error) => logBackend("worker", "queue_failed", {}, error),
    run: () =>
      database.maintainAccounts(
        (recipient) => mail.send({ recipient, kind: "deletion", token: "" }),
        config.QUEUE_SCHEMA
      ),
  });

  const service = serveWorker({
    service: "maintenance",
    host: config.MAINTENANCE_HOST,
    port: config.MAINTENANCE_PORT,
    secret: config.MAINTENANCE_WAKE_SECRET,
    resident: config.WORK_MODE === "resident",
    loop,
    ready: database.probe,
    close: async () => {
      mail.close();
      await database.close();
    },
  });

  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 30000).unref();
      void service.close().finally(() => clearTimeout(deadline));
    });

  try {
    await service.start();
  } catch (error) {
    await service.close();
    throw error;
  }
}

main().catch((error) => {
  logBackend("worker", "startup_failed", {}, error);
  process.exitCode = 1;
});
