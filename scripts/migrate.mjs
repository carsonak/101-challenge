/**
 * @file Applies tracked migrations before local application startup.
 * Run pnpm database:migrate after configuring MIGRATOR_DATABASE_URL in .env.operator.
 * The local launcher selects it as DATABASE_URL; direct execution accepts an explicit DATABASE_URL.
 * Requires migration-owner credentials.
 * Changes the selected database schema, reports redacted operator diagnostics,
 * and always closes connections. No administration or erasure action is exposed here.
 */
import { createRepository } from "@challenge/db";
import { reportCliFailure } from "./cli-diagnostics.mjs";

/** Apply migrations to the explicitly configured database and release connections. */
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Migration connection missing: set MIGRATOR_DATABASE_URL in .env.operator and run pnpm database:migrate."
    );
  }
  const database = createRepository(process.env.DATABASE_URL);
  try {
    await database.migrate();
    console.info("Tracker migrations applied");
  } finally {
    await database.close();
  }
}
main().catch((error) => {
  const hints = {
    ECONNREFUSED:
      "PostgreSQL is not reachable; start the configured local database service.",
    42501:
      "Use MIGRATOR_DATABASE_URL in .env.operator; the restricted web login cannot run migrations.",
    "28P01": "Check MIGRATOR_DATABASE_URL credentials in .env.operator.",
    "3D000": "Create the configured database before applying migrations.",
  };
  const hint = hints[error?.code];
  reportCliFailure(
    "database:migrate",
    error,
    hint ??
      "Check MIGRATOR_DATABASE_URL in .env.operator, database availability and migration ownership."
  );
  process.exitCode = 1;
});
