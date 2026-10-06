/**
 * @file Applies tracked migrations before local application startup.
 * Run pnpm database:migrate after configuring DATABASE_URL; the command builds
 * packages and loads the root .env. Requires migration-owner credentials.
 * Changes the selected database schema, never prints credentials or underlying errors,
 * and always closes connections. No administration or erasure action is exposed here.
 */
import { createRepository } from "@challenge/db";

/** Apply migrations to the explicitly configured database and release connections. */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  const database = createRepository(process.env.DATABASE_URL);
  try {
    await database.migrate();
    console.info("Tracker migrations applied");
  } finally {
    await database.close();
  }
}
main().catch(() => {
  console.error(
    "Migration failed; verify database access and migration-owner privileges"
  );
  process.exitCode = 1;
});
