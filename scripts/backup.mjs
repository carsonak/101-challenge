/**
 * @file Private operator tooling: backup|ledger encrypts PostgreSQL with age and optionally uploads to S3.
 * restore accepts only an empty *_restore_test database and requires the independently current ledger.
 * Supply BACKUP_DATABASE_URL or RESTORE_DATABASE_URL privately; decryption identities stay off the server.
 * Requires pg_dump/pg_restore, age and (for upload) aws on PATH; never prints database errors or private data.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createRepository } from "@challenge/db";

/** Keep database passwords in child environments rather than command arguments. */
function databaseEnvironment(connection) {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE:
      url.searchParams.get("sslmode") || process.env.PGSSLMODE || "prefer",
  };
}
/** Child errors are deliberately generic so operator credentials and rows never reach diagnostics. */
function command(binary, args, env = process.env) {
  const child = spawn(binary, args, { env, stdio: ["pipe", "pipe", "ignore"] });
  const done = new Promise((accept, reject) => {
    child.once("error", () => reject(new Error("Private command failed")));
    child.once("close", (code) =>
      code === 0 ? accept() : reject(new Error("Private command failed"))
    );
  });
  void done.catch(() => {});
  return { child, done };
}
/** Encrypt directly into a private atomic output; no plaintext dump or ledger is written. */
async function encrypt(source, file) {
  const recipient = process.env.AGE_RECIPIENT;
  if (!recipient || !/^age1[0-9a-z]+$/.test(recipient)) throw new Error();
  const temporary = `${file}.partial`;
  const age = command(process.env.AGE_BIN || "age", [
    "--encrypt",
    "--recipient",
    recipient,
  ]);
  try {
    await Promise.all([
      pipeline(source, age.child.stdin),
      pipeline(
        age.child.stdout,
        createWriteStream(temporary, { mode: 0o600, flags: "wx" })
      ),
      age.done,
    ]);
    await rename(temporary, file);
  } finally {
    age.child.kill();
    await rm(temporary, { force: true });
  }
}
/** Optional upload uses its own environment credentials and configurable S3-compatible endpoint. */
async function upload(file, key) {
  if (!process.env.BACKUP_S3_BUCKET) return;
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  if (endpoint && new URL(endpoint).protocol !== "https:") throw new Error();
  const target = `s3://${process.env.BACKUP_S3_BUCKET}/${(process.env.BACKUP_S3_PREFIX || "challenge").replace(/\/$/, "")}/${key}`;
  const aws = command(process.env.AWS_BIN || "aws", [
    ...(endpoint ? ["--endpoint-url", endpoint] : []),
    "s3",
    "cp",
    file,
    target,
    "--only-show-errors",
  ]);
  aws.child.stdin.end();
  aws.child.stdout.resume();
  await aws.done;
}
/** Current ledger is independent of snapshots and must be refreshed after erasures. */
async function ledger(connection, directory) {
  const database = createRepository(connection);
  try {
    const entries = await database.deletionLedger();
    const file = join(directory, "deletion-ledger-latest.json.age");
    await encrypt(Readable.from([JSON.stringify(entries)]), file);
    await upload(file, "deletion-ledger-latest.json.age");
    return entries.length;
  } finally {
    await database.close();
  }
}
/** Decrypt only the content-free ledger into private memory; identities are supplied locally. */
async function readLedger(file, identity) {
  const age = command(process.env.AGE_BIN || "age", [
    "--decrypt",
    "--identity",
    identity,
    file,
  ]);
  age.child.stdin.end();
  let data = "";
  for await (const chunk of age.child.stdout) data += chunk;
  await age.done;
  const entries = JSON.parse(data);
  if (
    !Array.isArray(entries) ||
    entries.some(
      (row) =>
        !/^[a-f0-9-]{36}$/.test(row.userId) ||
        !Number.isFinite(Date.parse(row.erasedAt))
    )
  )
    throw new Error();
  return entries.map((row) => row.userId);
}
/** Guard against overwriting participant data, then migrate and replay the latest trusted ledger. */
async function restore() {
  const connection = process.env.RESTORE_DATABASE_URL;
  if (!connection || !new URL(connection).pathname.endsWith("_restore_test"))
    throw new Error();
  const identity = process.env.AGE_IDENTITY_FILE,
    archive = process.env.RESTORE_ARCHIVE,
    currentLedger = process.env.RESTORE_LEDGER;
  if (!identity || !archive || !currentLedger) throw new Error();
  await readFile(identity); // Fail before any database changes if the off-server identity is unavailable.
  const { Pool } = createRequire(
    new URL("../packages/db/package.json", import.meta.url)
  )("pg");
  const pool = new Pool({ connectionString: connection });
  try {
    const result = await pool.query(
      "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m','S','f')"
    );
    if (result.rows[0].count !== 0) throw new Error();
  } finally {
    await pool.end();
  }
  const ids = await readLedger(currentLedger, identity);
  const age = command(process.env.AGE_BIN || "age", [
    "--decrypt",
    "--identity",
    identity,
    archive,
  ]);
  const pg = command(
    process.env.PG_RESTORE_BIN || "pg_restore",
    [
      "--dbname",
      new URL(connection).pathname.slice(1),
      "--no-owner",
      "--no-acl",
      "--clean",
      "--if-exists",
      "--single-transaction",
      "--schema=public",
    ],
    databaseEnvironment(connection)
  );
  age.child.stdin.end();
  pg.child.stdout.resume();
  try {
    await Promise.all([
      pipeline(age.child.stdout, pg.child.stdin),
      age.done,
      pg.done,
    ]);
  } finally {
    age.child.kill();
    pg.child.kill();
  }
  const database = createRepository(connection);
  try {
    await database.migrate();
    await database.replayErasures(ids);
  } finally {
    await database.close();
  }
  const reset = new Pool({ connectionString: connection });
  try {
    await reset.query(
      'UPDATE outbox SET "publishedAt"=NULL,"leasedUntil"=NULL,deliveries=0'
    );
  } finally {
    await reset.end();
  }
  console.info(
    "Isolated restore and latest deletion-ledger replay completed. Reapply runtime grants and bootstrap the empty worker queue before acceptance."
  );
}
try {
  const mode = process.argv[2];
  if (mode === "restore") await restore();
  else if (mode === "backup" || mode === "ledger") {
    const connection = process.env.BACKUP_DATABASE_URL,
      directory = process.env.BACKUP_DIR;
    if (!connection || !directory || resolve(directory) !== directory)
      throw new Error();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (mode === "backup") {
      const name = `database-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.dump.age`;
      const pg = command(
        process.env.PG_DUMP_BIN || "pg_dump",
        ["--format=custom", "--no-owner", "--no-acl", "--schema=public"],
        databaseEnvironment(connection)
      );
      pg.child.stdin.end();
      try {
        await Promise.all([
          encrypt(pg.child.stdout, join(directory, name)),
          pg.done,
        ]);
      } finally {
        pg.child.kill();
      }
      await upload(join(directory, name), name);
    }
    await ledger(connection, directory);
    console.info("Encrypted backup operation completed.");
  } else throw new Error();
} catch {
  console.error(
    "Backup/restore failed; check private configuration, tool availability and the empty isolated restore target. No private command output was retained."
  );
  process.exitCode = 1;
}
