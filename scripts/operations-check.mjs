/** @file Private read-only readiness, overdue-work and backup freshness check. Supply OPERATIONS_DATABASE_URL, OPERATIONS_READY_URL and BACKUP_SUCCESS_FILE. Exit nonzero for monitoring; sends no messages. Never prints private URLs or database errors. */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

/** Emit only a fixed check name and outcome, safe for operator alert routing. */
function outcome(check, ok) {
  console.info(JSON.stringify({ check, ok }));
  if (!ok) process.exitCode = 1;
}

/** Bound readiness I/O; HTTPS or loopback HTTP only, with no bearer-bearing URLs. */
async function readiness() {
  const url = new URL(process.env.OPERATIONS_READY_URL);
  if (
    url.username ||
    url.password ||
    url.search ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error();
  return (
    await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" })
  ).ok;
}

/** Verify that the last fully successful remote snapshot and ledger publication is at most 26 hours old. */
async function backupFresh() {
  const saved = JSON.parse(
    await readFile(process.env.BACKUP_SUCCESS_FILE, "utf8")
  );
  const age = Date.now() - Date.parse(saved.completedAt);
  return (
    saved.remote === true &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 26 * 3600000
  );
}

/** Query aggregate deadlines only; use a private SELECT-only operational login with statement and connection bounds. */
async function overdue() {
  if (!process.env.OPERATIONS_DATABASE_URL) throw new Error();
  const { Pool } = createRequire(
    new URL("../packages/db/package.json", import.meta.url)
  )("pg");
  const pool = new Pool({
    connectionString: process.env.OPERATIONS_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    options: "-c default_transaction_read_only=on",
  });
  try {
    const { rows } = await pool.query(`SELECT
      (SELECT count(*)::int FROM erasure_requests WHERE "processedAt" IS NULL AND "cancelledAt" IS NULL AND "deleteAfter" < now()-interval '5 minutes') AS erasures,
      (SELECT count(*)::int FROM account_mail WHERE "sentAt" IS NULL AND "nextAttemptAt" < now()-interval '5 minutes') AS mail,
      (SELECT count(*)::int FROM outbox WHERE "publishedAt" IS NULL AND ("occurredAt" < now()-interval '15 minutes' OR deliveries>=8)) AS events`);
    return rows[0].erasures === 0 && rows[0].mail === 0 && rows[0].events === 0;
  } finally {
    await pool.end();
  }
}

await Promise.all(
  [
    ["readiness", readiness],
    ["backup_fresh", backupFresh],
    ["overdue_work", overdue],
  ].map(async ([name, run]) => {
    try {
      outcome(name, await run());
    } catch {
      outcome(name, false);
    }
  })
);
