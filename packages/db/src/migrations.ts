import type { Pool, PoolClient } from "pg";

/** Ordered, append-only registry shared by migrations and readiness checks. */
export const trackerMigrations = [
  [1, "0001_tracker.sql"],
  [2, "0002_identity.sql"],
  [3, "0003_adapters.sql"],
  [4, "0004_jobs.sql"],
  [5, "0005_qa.sql"],
  [6, "0006_streak_boundaries.sql"],
  [7, "0007_discord_daily_loop.sql"],
  [8, "0008_idle_workers.sql"],
  [9, "0009_account_suspensions.sql"],
  [10, "0010_username_password.sql"],
] as const;

/** Reject readiness until every registered migration is applied; performs read-only I/O. */
export async function requireMigrations(
  database: Pick<Pool | PoolClient, "query">
) {
  const versions = trackerMigrations.map(([version]) => version);
  const result = await database.query(
    "SELECT version FROM tracker_migrations WHERE version = ANY($1::integer[])",
    [versions]
  );

  if (result.rowCount !== versions.length)
    throw Object.assign(new Error("Tracker migrations required"), {
      code: "MIGRATIONS_REQUIRED",
    });
}
