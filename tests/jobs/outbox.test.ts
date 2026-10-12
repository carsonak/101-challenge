/** @file Outbox outages, publish/mark crash, duplicate receipts and stale projections. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTracker } from "../../packages/core/src/index.js";
import {
  createJobStore,
  createRepository,
} from "../../packages/db/src/index.js";
import { required, target, url } from "./fixtures.js";
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

      assert.equal(
        (
          await db.repository.transaction((tx) =>
            tx.list("notifications", { userId: owner })
          )
        ).length,
        0
      );

      const notifications = [
        {
          createdAt: "1999-01-01T00:00:00Z",
          readAt: "1999-12-31T00:00:00Z",
          dismissedAt: null,
          retained: true,
        },
        {
          createdAt: "1999-01-01T00:00:00Z",
          readAt: "1999-12-02T00:00:00Z",
          dismissedAt: null,
          retained: true,
        },
        {
          createdAt: "1999-01-01T00:00:00Z",
          readAt: "1999-12-01T23:59:59Z",
          dismissedAt: null,
          retained: false,
        },
        {
          createdAt: "1999-01-01T00:00:00Z",
          readAt: null,
          dismissedAt: "1999-12-01T23:59:59Z",
          retained: false,
        },
        {
          createdAt: "1999-10-03T00:00:00Z",
          readAt: null,
          dismissedAt: null,
          retained: true,
        },
        {
          createdAt: "1999-10-02T23:59:59Z",
          readAt: null,
          dismissedAt: null,
          retained: false,
        },
      ].map((row) => ({ ...row, id: randomUUID() }));

      await db.repository.transaction(async (tx) => {
        for (const { retained: _retained, ...row } of notifications)
          await tx.insert("notifications", {
            ...row,
            userId: owner,
            message: "Fictional system reminder",
            href: "/home",
          });
      });

      await store.housekeeping();
      const remaining = await db.repository.transaction((tx) =>
        tx.list("notifications", { userId: owner })
      );

      assert.deepEqual(
        remaining.map((row) => row.id).sort(),
        notifications
          .filter((row) => row.retained)
          .map((row) => row.id)
          .sort()
      );
    } finally {
      await store.close();
      await db.close();
      await isolated.close();
    }
  }
);
