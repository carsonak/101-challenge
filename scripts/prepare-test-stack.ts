/** @file Provision nonsuperuser identities for a disposable production/browser stack. Never targets participant databases. */
import { createRepository, provisionDatabase } from "@challenge/db";
/** Explicit operator fixture URL; passwords here are fictional local-test credentials. */
const connection = process.env.TRACKER_TEST_DATABASE_URL;
if (!connection || !/_(test|ci)$/.test(new URL(connection).pathname))
  throw new Error("Disposable operator database required");
/** Fixed identities are reserved for serial test-stack setup within this isolated cluster. */
const logins = Object.fromEntries(
  ["migrator", "web", "worker", "maintenance"].map((kind) => [
    kind,
    { name: `hardening_${kind}`, password: "fictional-stack-password" },
  ])
) as Parameters<typeof provisionDatabase>[1];
/** Keep login credentials inside process configuration, never emit a connection URL. */
function loginUrl(kind: keyof typeof logins) {
  const url = new URL(connection as string);
  url.username = logins[kind].name;
  url.password = logins[kind].password;
  return url.toString();
}
await provisionDatabase(
  connection,
  logins,
  process.env.QUEUE_SCHEMA ?? "pgboss_hardening",
  "roles"
);
const db = createRepository(loginUrl("migrator"));
try {
  await db.migrate();
} finally {
  await db.close();
}
await provisionDatabase(
  connection,
  logins,
  process.env.QUEUE_SCHEMA ?? "pgboss_hardening",
  "grants"
);
console.info("Disposable restricted-login stack prepared");
