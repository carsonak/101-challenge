/** @file Exercise real non-superuser logins, migrations, queue access and erasure on an exclusive database. */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  createRepository,
  createJobStore,
  provisionDatabase,
} from "../packages/db/src/index.js";
import { createTracker } from "../packages/core/src/index.js";
/** Explicit disposable operator connection; never uses the participant environment. */
const connection = process.env.TRACKER_TEST_DATABASE_URL;
if (connection && !/_(test|ci)$/.test(new URL(connection).pathname))
  throw new Error("Disposable database required");

/** Load the DB-owned driver for isolated operator fixtures. */
const { Pool } = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");

test(
  "restricted logins migrate, run web commands, publish/process/clean jobs and erase due accounts",
  { skip: !connection },
  async () => {
    assert.ok(connection);
    const operator = new Pool({ connectionString: connection, max: 1 });
    const suffix = randomUUID().replaceAll("-", "");
    const name = `topology_${suffix}_test`;
    const url = new URL(connection);
    url.pathname = `/${name}`;
    const logins = Object.fromEntries(
      ["migrator", "web", "worker", "maintenance"].map((kind) => [
        kind,
        { name: `${kind}_${suffix}`, password: "fictional-topology-password" },
      ])
    ) as Parameters<typeof provisionDatabase>[1];

    const handles: { close(): Promise<void> }[] = [];
    const loginUrl = (kind: keyof typeof logins) => {
      const value = new URL(url);
      value.username = logins[kind].name;
      value.password = logins[kind].password;
      return value.toString();
    };

    await operator.query(`CREATE DATABASE "${name}"`);
    try {
      await provisionDatabase(
        url.toString(),
        logins,
        "topology_queue",
        "roles"
      );

      const migration = createRepository(loginUrl("migrator"));
      handles.push(migration);
      await migration.migrate();
      await provisionDatabase(
        url.toString(),
        logins,
        "topology_queue",
        "grants"
      );

      await provisionDatabase(
        url.toString(),
        logins,
        "topology_queue",
        "grants"
      );

      const web = createRepository(loginUrl("web"), true);
      handles.push(web);
      let instant = new Date("2026-01-01T09:00:00Z");
      const tracker = createTracker(web.repository, { now: () => instant });
      for (const kind of ["migrator", "maintenance"] as const) {
        const inherited = new Pool({
          connectionString: loginUrl(kind),
          max: 1,
        });

        try {
          assert.equal(
            (
              await inherited.query(
                "SELECT pg_has_role(current_user,'challenge_tracker_erasure','USAGE') AS inherited"
              )
            ).rows[0].inherited,
            true
          );
        } finally {
          await inherited.end();
        }
      }

      const fixtureTracker = createTracker(migration.repository);
      const admin = await fixtureTracker.createUser(true);
      const user = await tracker.createUser();
      const season = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          title: "Restricted fixture",
          slug: `restricted-${suffix}`,
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
        user,
        { command: "Enroll", seasonId: season.resourceId },
        randomUUID()
      );

      const attempt = await tracker.execute(
        user,
        {
          command: "StartAttempt",
          enrollmentId: enrollment.resourceId,
          expectedEnrollmentVersion: enrollment.version,
          goals: [{ title: "Fictional goal", kind: "qualitative" }],
          milestones: [],
        },
        randomUUID()
      );

      await tracker.execute(
        user,
        {
          command: "SubmitReport",
          attemptId: attempt.resourceId,
          expectedAttemptVersion: attempt.version,
          body: "Fictional report",
          goalValues: [],
        },
        randomUUID()
      );

      assert.equal((await tracker.dailySummary(user))[0].reportingDays, 1);
      assert.equal(
        (await tracker.history(user))[0].attempts[0].reports.length,
        1
      );

      const restricted = new Pool({
        connectionString: loginUrl("web"),
        max: 1,
      });

      try {
        for (const sql of [
          "SELECT * FROM deletion_ledger",
          "SELECT * FROM event_receipts",
          "SELECT * FROM source_projections",
          "UPDATE users SET admin=true",
          "INSERT INTO account_suspensions(id) SELECT id FROM users LIMIT 1",
          "DELETE FROM account_suspensions",
          "SELECT erase_tracker_account($1,$2,NULL)",
        ])
          await assert.rejects(
            restricted.query(
              sql,
              sql.includes("$1") ? [user, randomUUID()] : []
            ),
            { code: "42501" }
          );

        for (const kind of Object.keys(logins) as (keyof typeof logins)[]) {
          const pool = new Pool({ connectionString: loginUrl(kind), max: 1 });
          try {
            assert.equal(
              (
                await pool.query(
                  "SELECT rolsuper FROM pg_roles WHERE rolname=current_user"
                )
              ).rows[0].rolsuper,
              false
            );
          } finally {
            await pool.end();
          }
        }
      } finally {
        await restricted.end();
      }

      const worker = createJobStore(loginUrl("worker"));
      handles.push(worker);
      const privateWorker = new Pool({
        connectionString: loginUrl("worker"),
        max: 1,
      });

      try {
        for (const sql of [
          "SELECT body FROM reports",
          'SELECT "participantSeed" FROM users',
          "SELECT * FROM attempts",
        ])
          await assert.rejects(privateWorker.query(sql), { code: "42501" });
      } finally {
        await privateWorker.end();
      }

      await worker.ready();
      await worker.publish(async (event) => {
        await worker.process(event);
      });

      await worker.housekeeping();
      const PgBoss = createRequire(
        new URL("../apps/worker/package.json", import.meta.url)
      )("pg-boss").PgBoss;

      const boss = new PgBoss({
        connectionString: loginUrl("worker"),
        schema: "topology_queue",
        createSchema: false,
      });

      try {
        await boss.start();
        await boss.createQueue("topology_probe");
        assert.ok(await boss.getQueue("topology_probe"));
      } finally {
        await boss.stop();
      }

      for (let version = 1; version < 101; version++) {
        instant = new Date(instant.getTime() + 86400000);
        await tracker.execute(
          user,
          {
            command: "SubmitReport",
            attemptId: attempt.resourceId,
            expectedAttemptVersion: version,
            body: "Fictional completion report",
            goalValues: [],
          },
          randomUUID()
        );
      }

      assert.ok((await tracker.source(user, attempt.resourceId)).completion);
      assert.equal((await tracker.dailySummary(user))[0].reportingDays, 101);

      const requestId = randomUUID();
      await migration.repository.transaction((tx) =>
        tx.insert("erasure_requests", {
          id: requestId,
          userId: user,
          requestedAt: "2000-01-01T00:00:00Z",
          deleteAfter: "2000-01-08T00:00:00Z",
          cancelledAt: null,
          processedAt: null,
        })
      );

      await migration.repository.transaction((tx) =>
        tx.insert("account_suspensions", {
          id: user,
          suspendedAt: instant.toISOString(),
        })
      );

      const maintenance = createRepository(loginUrl("maintenance"));
      handles.push(maintenance);
      await maintenance.maintainAccounts(async () => {}, "topology_queue");
      assert.equal(
        await migration.repository.transaction((tx) =>
          tx.get("account_suspensions", user)
        ),
        undefined
      );

      assert.equal(
        (await migration.deletionLedger()).some((row) => row.userId === user),
        true
      );
    } finally {
      for (const handle of handles.reverse()) await handle.close();

      await operator.query(`DROP DATABASE "${name}"`);
      for (const value of Object.values(logins))
        await operator.query(`DROP ROLE "${value.name}"`);

      await operator.end();
    }
  }
);
