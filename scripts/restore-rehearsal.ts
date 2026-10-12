import { runRehearsalBackup } from "./restore-process.js";
/** @file Rehearse encrypted dump/restore and newest-ledger replay on exclusive fictional databases. Requires TRACKER_TEST_DATABASE_URL, AGE_BIN, AGE_KEYGEN_BIN and absolute REHEARSAL_OUTPUT; never uses web .env. */
import { createRepository, provisionDatabase } from "@challenge/db";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createTracker } from "../packages/core/src/index.js";

/** Only explicitly disposable operator connections are accepted. */
const connection = process.env.TRACKER_TEST_DATABASE_URL,
  output = process.env.REHEARSAL_OUTPUT;

if (
  !connection ||
  !/_(test|ci)$/.test(new URL(connection).pathname) ||
  !output ||
  resolve(output) !== output ||
  !process.env.AGE_BIN ||
  !process.env.AGE_KEYGEN_BIN
)
  throw new Error("Explicit isolated rehearsal configuration required");

/** Temporary synthetic age identity stays private and is removed after the rehearsal. */
const privateDirectory = await mkdtemp(join(tmpdir(), "challenge-restore-")),
  identity = join(privateDirectory, "identity");

execFileSync(process.env.AGE_KEYGEN_BIN, ["-o", identity], { stdio: "ignore" });
const recipient = execFileSync(process.env.AGE_KEYGEN_BIN, ["-y", identity], {
  encoding: "utf8",
}).trim();

await mkdir(output, { recursive: true, mode: 0o700 });
/** Isolated role and database identifiers contain only generated safe characters. */
const suffix = randomUUID().replaceAll("-", ""),
  sourceName = `rehearsal_${suffix}_test`,
  restoreName = `rehearsal_${suffix}_restore_test`;

/** Build one fictional isolated login without weakening the four-role contract. */
function login(kind: string) {
  return { name: `${kind}_${suffix}`, password: "fictional-restore-password" };
}

const logins = {
  migrator: login("migrator"),
  web: login("web"),
  worker: login("worker"),
  maintenance: login("maintenance"),
} satisfies Parameters<typeof provisionDatabase>[1];

const driver = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");

const { Pool } = driver;
const operator = new Pool({ connectionString: connection });
/** URLs stay in process environments and are never passed as command arguments. */
function databaseUrl(name: string, kind?: keyof typeof logins) {
  const url = new URL(connection as string);
  url.pathname = `/${name}`;
  if (kind) {
    url.username = logins[kind].name;
    url.password = logins[kind].password;
  }

  return url.toString();
}

let source: ReturnType<typeof createRepository> | undefined,
  restored: ReturnType<typeof createRepository> | undefined;

const begun = performance.now();
try {
  await operator.query(`CREATE DATABASE "${sourceName}"`);
  await provisionDatabase(
    databaseUrl(sourceName),
    logins,
    "rehearsal_queue",
    "roles"
  );

  await operator.query(
    `ALTER DATABASE "${sourceName}" OWNER TO "${logins.migrator.name}"`
  );

  await operator.query(
    `CREATE DATABASE "${restoreName}" OWNER "${logins.migrator.name}"`
  );

  source = createRepository(databaseUrl(sourceName, "migrator"));
  await source.migrate();
  await provisionDatabase(
    databaseUrl(sourceName),
    logins,
    "rehearsal_queue",
    "grants"
  );

  let instant = new Date("2026-01-01T09:00:00Z");
  const tracker = createTracker(source.repository, { now: () => instant });
  const admin = await tracker.createUser(true),
    retained = await tracker.createUser(),
    erased = await tracker.createUser();

  const season = await tracker.execute(
    admin,
    {
      command: "CreateSeason",
      slug: `restore-${suffix}`,
      title: "Fictional restore practice",
    },
    randomUUID()
  );

  await tracker.execute(
    admin,
    {
      command: "PublishSeason",
      seasonId: season.resourceId,
      expectedSeasonVersion: 0,
    },
    randomUUID()
  );

  const enrollment = await tracker.execute(
    retained,
    { command: "Enroll", seasonId: season.resourceId },
    randomUUID()
  );

  const attempt = await tracker.execute(
    retained,
    {
      command: "StartAttempt",
      enrollmentId: enrollment.resourceId,
      expectedEnrollmentVersion: 0,
      goals: [{ title: "Fictional practice", kind: "qualitative" }],
    },
    randomUUID()
  );

  for (let version = 0; version < 101; version++) {
    if (version) instant = new Date(instant.getTime() + 86400000);

    await tracker.execute(
      retained,
      {
        command: "SubmitReport",
        attemptId: attempt.resourceId,
        expectedAttemptVersion: version,
        body: "Fictional report ".repeat(120),
        goalValues: [],
      },
      randomUUID()
    );
  }

  const original = await tracker.source(retained, attempt.resourceId);
  assert.ok(original.completion);
  const seed = (
    await source.repository.transaction((tx) => tx.get("users", retained))
  )?.participantSeed;

  const erasedEnrollment = await tracker.execute(
    erased,
    { command: "Enroll", seasonId: season.resourceId },
    randomUUID()
  );

  await runRehearsalBackup(recipient, "backup", {
    BACKUP_DATABASE_URL: databaseUrl(sourceName, "migrator"),
    BACKUP_DIR: output,
  });

  const request = randomUUID();
  await source.repository.transaction((tx) =>
    tx.insert("erasure_requests", {
      id: request,
      userId: erased,
      requestedAt: "2000-01-01T00:00:00Z",
      deleteAfter: "2000-01-08T00:00:00Z",
      cancelledAt: null,
      processedAt: null,
    })
  );

  await source.maintainAccounts(async () => {});
  await runRehearsalBackup(recipient, "ledger", {
    BACKUP_DATABASE_URL: databaseUrl(sourceName, "migrator"),
    BACKUP_DIR: output,
  });

  const { readdir } = await import("node:fs/promises");
  const archives = (await readdir(output))
    .filter((name) => name.endsWith(".dump.age"))
    .sort();

  await runRehearsalBackup(recipient, "restore", {
    RESTORE_DATABASE_URL: databaseUrl(restoreName, "migrator"),
    RESTORE_ARCHIVE: join(output, archives.at(-1) as string),
    RESTORE_LEDGER: join(output, "deletion-ledger-latest.json.age"),
    AGE_IDENTITY_FILE: identity,
  });

  restored = createRepository(databaseUrl(restoreName, "migrator"));
  const restoredTracker = createTracker(restored.repository, {
    now: () => instant,
  });

  assert.equal(
    await restored.repository.transaction((tx) => tx.get("users", erased)),
    undefined
  );

  assert.equal(
    await restored.repository.transaction((tx) =>
      tx.get("enrollments", erasedEnrollment.resourceId)
    ),
    undefined
  );

  assert.equal(
    (await restored.repository.transaction((tx) => tx.get("users", retained)))
      ?.participantSeed,
    seed
  );

  const recovered = await restoredTracker.source(retained, attempt.resourceId);
  assert.deepEqual(recovered.completion, original.completion);
  assert.equal(recovered.baseSeed, original.baseSeed);
  assert.equal(recovered.reports.length, 101);
  // Instrument this fictional process only; never inspect or retain SQL text or parameters.
  let sqlCalls = 0;
  const originalQuery = driver.Client.prototype.query;
  driver.Client.prototype.query = function (this: unknown, ...args: unknown[]) {
    sqlCalls++;
    return originalQuery.apply(this, args);
  };

  const measures: Record<string, number[]> = {};
  for (const [name, query] of Object.entries({
    history: () => restoredTracker.history(retained),
    summary: () => restoredTracker.dailySummary(retained),
    admin: () => restoredTracker.adminStats(admin),
  })) {
    measures[name] = [];
    for (let sample = 0; sample < 5; sample++) {
      sqlCalls = 0;
      const start = performance.now();
      const value = await query();
      measures[name].push(Math.round(performance.now() - start));
      if (sample === 4)
        console.info(
          `${name}: ${Buffer.byteLength(JSON.stringify(value))} bytes, ${sqlCalls} SQL calls`
        );
    }
  }

  driver.Client.prototype.query = originalQuery;
  await assert.rejects(
    runRehearsalBackup(recipient, "restore", {
      RESTORE_DATABASE_URL: databaseUrl(restoreName, "migrator"),
      RESTORE_ARCHIVE: join(output, archives.at(-1) as string),
      RESTORE_LEDGER: join(output, "deletion-ledger-latest.json.age"),
      AGE_IDENTITY_FILE: identity,
    }),
    /Rehearsal operation failed/
  );

  console.info(
    JSON.stringify({
      restoredReports: 101,
      erasedAccountsReplayed: 1,
      stableCompletionAndSeeds: true,
      totalMs: Math.round(performance.now() - begun),
      queryMs: measures,
    })
  );

  assert.ok(
    (await readFile(join(output, archives.at(-1) as string)))
      .subarray(0, 3)
      .equals(Buffer.from("age"))
  );
} finally {
  await restored?.close();
  await source?.close();
  for (const name of [restoreName, sourceName])
    await operator.query(`DROP DATABASE IF EXISTS "${name}"`);

  for (const value of Object.values(logins))
    await operator.query(`DROP ROLE IF EXISTS "${value.name}"`);

  await operator.end();
  await rm(privateDirectory, { recursive: true, force: true });
}
