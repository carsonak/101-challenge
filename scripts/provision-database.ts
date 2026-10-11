/** @file Operator-only role/grant provisioning. Read passwords from private environment; never loads web .env. */
import {
  provisionDatabase,
  type DatabaseLogins,
} from "../packages/db/src/provision.js";
// Native scripts share the compiled backend redactor and have no TypeScript declaration dependency.
/** Print redacted developer diagnostics for provisioning failures. */
const { reportCliFailure } = await import("./cli-diagnostics.mjs" as string);
/** Require a private setting without printing its value. */
function setting(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
// Roles precede migration; grants follow it.
try {
  const phase = process.argv[2];
  if (phase !== "roles" && phase !== "grants")
    throw new Error("Usage: pnpm database:provision roles|grants");
  const logins = Object.fromEntries(
    ["migrator", "web", "worker", "maintenance"].map((kind) => [
      kind,
      {
        name: setting(`${kind.toUpperCase()}_DB_USER`),
        password: setting(`${kind.toUpperCase()}_DB_PASSWORD`),
      },
    ])
  ) as unknown as DatabaseLogins;
  await provisionDatabase(
    setting("OPERATOR_DATABASE_URL"),
    logins,
    setting("QUEUE_SCHEMA"),
    phase
  );
} catch (error) {
  reportCliFailure(
    "database:provision",
    error,
    "Check OPERATOR_DATABASE_URL and role settings in .env.operator; provision roles, migrate, then provision grants."
  );
  process.exitCode = 1;
}
