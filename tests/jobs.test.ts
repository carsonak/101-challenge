/** @file Real outbox retry and two-worker fixtures use a dedicated disposable queue schema. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequire } from "node:module";
import { createTracker } from "../packages/core/src/index.js";
import { createRepository, createJobStore } from "../packages/db/src/index.js";
import { startJobs } from "../apps/worker/src/jobs.js";
/** Resolve the worker's own pinned queue package for integration fixtures. */
const require = createRequire(
  new URL("../apps/worker/package.json", import.meta.url)
);
/** Explicit disposable database; queue schema is unique to each test. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");
/** Require fictional fixture existence. */
function required<T>(v: T | null | undefined): T {
  assert.ok(v != null);
  return v;
}
/** Give destructive/housekeeping worker fixtures their own disposable database and cleanup. */
async function target() {
  const connection = new URL(required(url));
  const name = `tracker_jobs_${randomUUID().replaceAll("-", "")}_test`;
  const { Pool } = createRequire(
    new URL("../packages/db/package.json", import.meta.url)
  )("pg");
  const pool = new Pool({ connectionString: connection.toString(), max: 1 });
  await pool.query(`CREATE DATABASE "${name}"`);
  connection.pathname = `/${name}`;
  return {
    url: connection.toString(),
    async close() {
      await pool.query(`DROP DATABASE "${name}"`);
      await pool.end();
    },
  };
}

test(
  "Outbox outages, publish/mark crash, duplicate receipts and stale projections",
  { skip: !url },
  async () => {
    const isolated = await target();
    const db = createRepository(isolated.url),
      store = createJobStore(
        isolated.url,
        () => new Date("2000-01-01T00:00:00Z")
      );
    await db.migrate();
    const tracker = createTracker(db.repository);
    try {
      const admin = await tracker.createUser(true),
        owner = await tracker.createUser(),
        s = await tracker.execute(
          admin,
          {
            command: "CreateSeason",
            slug: randomUUID(),
            title: "Fictional worker season",
          },
          randomUUID()
        );
      await tracker.execute(
        admin,
        {
          command: "PublishSeason",
          seasonId: s.resourceId,
          expectedSeasonVersion: 0,
        },
        randomUUID()
      );
      const e = await tracker.execute(
          owner,
          { command: "Enroll", seasonId: s.resourceId },
          randomUUID()
        ),
        a = await tracker.execute(
          owner,
          {
            command: "StartAttempt",
            enrollmentId: e.resourceId,
            expectedEnrollmentVersion: 0,
            timezone: "Africa/Nairobi",
            goals: [{ title: "Private worker goal", kind: "qualitative" }],
          },
          randomUUID()
        );
      const event = required(
        (
          await db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: a.resourceId })
          )
        ).at(-1)
      );
      // Failure is deliberately after logical enqueue, simulating a publish/mark crash.
      const deliveries: unknown[] = [];
      await store.publish(async (envelope) => {
        deliveries.push(envelope);
        throw new Error("fictional private failure must not persist");
      });
      assert.ok(deliveries.length > 0);
      const failed = required(
        await db.repository.transaction((tx) => tx.get("outbox", event.id))
      );
      assert.equal(failed.publishedAt, null);
      assert.ok(failed.lastFailureAt);
      await db.repository.transaction((tx) =>
        tx.save("outbox", { ...failed, leasedUntil: "2000-01-01T00:00:00Z" })
      );
      await store.publish(async (envelope) => {
        deliveries.push(envelope);
      });
      assert.ok(
        required(
          await db.repository.transaction((tx) => tx.get("outbox", event.id))
        ).publishedAt
      );
      const envelope = required(
        deliveries.find((v) => (v as { eventId: string }).eventId === event.id)
      );
      const results = await Promise.all([
        store.process(envelope),
        store.process(envelope),
      ]);
      assert.deepEqual(results.sort(), ["duplicate", "processed"]);
      await tracker.execute(
        owner,
        {
          command: "SubmitReport",
          attemptId: a.resourceId,
          expectedAttemptVersion: 0,
          body: "fictional worker private report",
          goalValues: [],
        },
        randomUUID()
      );
      // A report commits successfully although the queue transport was unavailable.
      assert.equal(
        (await tracker.history(owner))[0].attempts[0].reportingDays,
        1
      );
      assert.equal(await store.process(envelope), "duplicate");
      assert.equal(
        JSON.stringify(deliveries).includes("Private worker goal"),
        false
      );
      assert.equal(
        JSON.stringify(deliveries).includes("fictional worker private report"),
        false
      );
      const next = required(
        (
          await db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: a.resourceId })
          )
        )
          .sort((a, b) => b.sourceVersion - a.sourceVersion)
          .at(0)
      );
      await store.process({
        eventId: next.id,
        type: next.type,
        schemaVersion: 1,
        aggregateId: next.aggregateId,
        sourceVersion: next.sourceVersion,
        occurredAt: next.occurredAt,
      });
      const before = required(await store.projection(a.resourceId));
      assert.equal(before.reportingDays, 1);
      const stale = {
        ...event,
        id: randomUUID(),
        publishedAt: null,
        deliveries: 0,
        leasedUntil: null,
        lastFailureAt: null,
      };
      await db.repository.transaction((tx) => tx.insert("outbox", stale));
      await store.process({
        eventId: stale.id,
        type: stale.type,
        schemaVersion: 1,
        aggregateId: stale.aggregateId,
        sourceVersion: stale.sourceVersion,
        occurredAt: stale.occurredAt,
      });
      assert.deepEqual(await store.projection(a.resourceId), before);
      const replayId = randomUUID();
      await db.repository.transaction((tx) =>
        tx.insert("replays", {
          id: replayId,
          userId: owner,
          command: "Enroll",
          key: randomUUID(),
          requestHash: "fictional",
          resourceId: e.resourceId,
          version: 0,
          expiresAt: "1999-01-01T00:00:00Z",
        })
      );
      await store.housekeeping();
      await store.housekeeping();
      assert.equal(
        await db.repository.transaction((tx) => tx.get("replays", replayId)),
        undefined
      );
    } finally {
      await store.close();
      await db.close();
      await isolated.close();
    }
  }
);
test(
  "Two pg-boss workers share only their isolated queue and process real deliveries",
  { skip: !url },
  async () => {
    const { PgBoss } = require("pg-boss");
    const schema = `pgboss_fixture_${randomUUID().replaceAll("-", "")}`;
    const isolated = await target();
    const db = createRepository(isolated.url);
    await db.migrate();
    const one = createJobStore(
        isolated.url,
        () => new Date("2000-01-01T00:00:00Z")
      ),
      two = createJobStore(
        isolated.url,
        () => new Date("2000-01-01T00:00:00Z")
      );
    const bosses = [
      new PgBoss({ connectionString: isolated.url, schema }),
      new PgBoss({ connectionString: isolated.url, schema }),
    ];
    let stopA: undefined | (() => Promise<void>),
      stopB: undefined | (() => Promise<void>);
    for (const b of bosses) b.on("error", () => {});
    try {
      for (const b of bosses) await b.start();
      stopA = await startJobs(bosses[0], one);
      stopB = await startJobs(bosses[1], two);
      const tracker = createTracker(db.repository),
        admin = await tracker.createUser(true);
      const s = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional queue season",
        },
        randomUUID()
      );
      const event = required(
        (
          await db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: s.resourceId })
          )
        ).at(-1)
      );
      await one.publish(async (envelope) => {
        await bosses[0].send("tracker_projection", envelope, {
          singletonKey: envelope.eventId,
        });
      });
      const deadline = Date.now() + 15000;
      let status = "";
      while (Date.now() < deadline) {
        const job = await bosses[0].findJobs("tracker_projection", {
          data: { eventId: event.id },
        });
        status = job[0]?.state ?? "";
        if (status === "completed") break;
        await new Promise((r) => setTimeout(r, 250));
      }
      assert.equal(status, "completed");
      assert.equal(
        (await db.repository.transaction((tx) => tx.get("outbox", event.id)))
          ?.publishedAt !== null,
        true
      );
    } finally {
      await stopA?.();
      await stopB?.();
      for (const b of bosses) await b.stop();
      await one.close();
      await two.close();
      await db.close();
      await isolated.close();
    }
  }
);
