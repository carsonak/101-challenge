/**
 * @file Run one account-mail retry and due-erasure sweep with a separately supplied privileged connection.
 * Invoke `pnpm accounts:maintain` once, or `pnpm accounts:schedule` for sleeping deadline-driven execution. Local commands scope .env/.env.operator to maintenance.
 * Sends private recovery notices, removes due accounts, and closes resources; never prints recipients or secrets.
 */
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createRepository } from "@challenge/db";
import { createMailer } from "../apps/web/server/mail";
/** Shared redacted CLI reporter; direct container execution also uses it. */
const { reportCliFailure } = await import("./cli-diagnostics.mjs" as string);

// The privileged connection belongs only to this maintenance process.
try {
  const connection = process.env.ERASURE_DATABASE_URL;
  if (!connection)
    throw new Error(
      "Set ERASURE_DATABASE_URL in .env.operator for account maintenance"
    );

  const config = parseServerConfig(process.env);
  const database = createRepository(connection);
  const mail = createMailer(config);
  try {
    const nextRunAt = await database.maintainAccounts(
      (recipient) => mail.send({ recipient, kind: "deletion", token: "" }),
      process.env.QUEUE_SCHEMA
    );

    console.info(
      JSON.stringify({
        nextRunAt:
          nextRunAt === null ? null : new Date(nextRunAt).toISOString(),
      })
    );
  } finally {
    mail.close();
    await database.close();
  }
} catch (error) {
  reportCliFailure(
    "accounts:maintain",
    error,
    "Check ERASURE_DATABASE_URL in .env.operator and SMTP settings in .env."
  );

  process.exitCode = 1;
}
