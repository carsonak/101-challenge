/**
 * @file Run one account-mail retry and due-erasure sweep with a separately supplied privileged connection.
 * Invoke `pnpm accounts:maintain` every minute from an operator-owned scheduler. Does not load web runtime credentials.
 * Sends private recovery notices, removes due accounts, and closes resources; never prints recipients or secrets.
 */
import { parseServerConfig } from "@challenge/contracts";
import { createRepository } from "@challenge/db";
import { createMailer } from "../apps/web/server/mail";

/** Explicit privileged connection belongs only to this maintenance process. */
const connection = process.env.ERASURE_DATABASE_URL;
if (!connection)
  throw new Error("ERASURE_DATABASE_URL is required for account maintenance");
/** Separate short-lived service handles. */
const database = createRepository(connection);
/** Mail transport uses the same private delivery configuration as verification. */
const mail = createMailer(parseServerConfig(process.env));
try {
  await database.maintainAccounts(
    (recipient) => mail.send({ recipient, kind: "deletion", token: "" }),
    process.env.QUEUE_SCHEMA
  );
} finally {
  mail.close();
  await database.close();
}
