/** @file PostgreSQL privileged erasure removes private graph and revokes sessions. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createAuth, createTracker } from "../../packages/core/src/index.js";
import {
  createJobStore,
  createRepository,
} from "../../packages/db/src/index.js";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL privileged erasure removes private graph and revokes sessions",
  { skip: !url },
  async () => {
    const f = await fixture();
    const jobs = createJobStore(required(url));
    try {
      const owner = await f.signup(),
        actor = await f.auth.authenticate(owner.token);

      let reportingInstant = new Date("2026-01-01T09:00:00Z");
      const tracker = createTracker(f.db.repository, {
        now: () => reportingInstant,
      });

      const admin = await tracker.createUser(true);
      const season = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Erasure fixture",
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
        actor.userId,
        { command: "Enroll", seasonId: season.resourceId },
        randomUUID()
      );

      const started = await tracker.execute(
        actor.userId,
        {
          command: "StartAttempt",
          enrollmentId: enrollment.resourceId,
          expectedEnrollmentVersion: 0,
          timezone: "Africa/Nairobi",
          goals: [{ title: "Private erasure fixture", kind: "qualitative" }],
        },
        randomUUID()
      );

      for (let version = 0; version < 101; version++) {
        if (version)
          reportingInstant = new Date(reportingInstant.getTime() + 86400000);

        await tracker.execute(
          actor.userId,
          {
            command: "SubmitReport",
            attemptId: started.resourceId,
            expectedAttemptVersion: version,
            body: "Private report to erase",
            goalValues: [],
          },
          randomUUID()
        );
      }

      assert.ok(
        (await tracker.source(actor.userId, started.resourceId)).completion
      );

      const app = createRepository(required(url), true);
      try {
        const appAuth = createAuth(app.repository, {
          now: f.now,
          sendMail: async () => {},
        });

        assert.equal((await appAuth.account(owner.token)).id, actor.userId);
        await assert.rejects(app.eraseAccount(actor.userId, randomUUID()), {
          code: "42501",
        });

        await assert.rejects(app.deletionLedger(), { code: "42501" });
        const record = required(
          await app.repository.transaction((tx) =>
            tx.get("users", actor.userId)
          )
        );

        await assert.rejects(
          app.repository.transaction((tx) =>
            tx.save("users", { ...record, admin: true })
          ),
          { code: "42501" }
        );

        await assert.rejects(app.migrate(), { code: "42501" });
      } finally {
        await app.close();
      }

      const event = required(
        (
          await f.db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: started.resourceId })
          )
        )
          .sort((a, b) => b.sourceVersion - a.sourceVersion)
          .at(0)
      );

      await jobs.process({
        eventId: event.id,
        type: event.type,
        schemaVersion: 1,
        aggregateId: event.aggregateId,
        sourceVersion: event.sourceVersion,
        occurredAt: event.occurredAt,
      });

      assert.equal(
        required(await jobs.projection(started.resourceId)).reportingDays,
        101
      );

      const form = await f.db.interactionForm({
        userId: actor.userId,
        kind: "edit",
        resourceId: started.resourceId,
        version: 0,
        enrollmentId: enrollment.resourceId,
        enrollmentVersion: 0,
      });

      const request = await f.auth.execute(
        {
          action: "request_erasure",
          confirmed: true,
          username: (await f.auth.account(owner.token)).username,
        },
        owner.token,
        owner.csrf
      );

      assert.ok("requestId" in request);
      const requestId = required(request.requestId);
      // Maintenance uses PostgreSQL's wall clock, independently of the auth fixture clock.
      await f.db.repository.transaction(async (tx) => {
        const row = await tx.get("erasure_requests", requestId, true);
        assert.ok(row);
        row.deleteAfter = new Date(Date.now() + 86400000).toISOString();
        await tx.save("erasure_requests", row);
      });

      await assert.rejects(f.db.eraseAccount(actor.userId, randomUUID()), {
        code: "42501",
      });

      await assert.rejects(f.db.eraseAccount(actor.userId, requestId), {
        code: "42501",
      });

      await f.db.repository.transaction(async (tx) => {
        const row = await tx.get("erasure_requests", requestId, true);
        assert.ok(row);
        row.deleteAfter = "2000-01-01T00:00:00.000Z";
        await tx.save("erasure_requests", row);
      });

      await f.db.eraseAccount(actor.userId, requestId);
      assert.equal(await jobs.projection(started.resourceId), undefined);
      assert.equal(
        await f.db.interactionContext(form, actor.userId),
        undefined
      );

      assert.equal(
        await jobs.process({
          eventId: event.id,
          type: event.type,
          schemaVersion: 1,
          aggregateId: event.aggregateId,
          sourceVersion: event.sourceVersion,
          occurredAt: event.occurredAt,
        }),
        "ignored"
      );

      await assert.rejects(f.auth.authenticate(owner.token), {
        code: "UNAUTHENTICATED",
      });

      assert.equal(
        await f.db.repository.transaction((tx) =>
          tx.get("users", actor.userId)
        ),
        undefined
      );

      assert.equal(
        await f.db.repository.transaction((tx) =>
          tx.get("attempts", started.resourceId)
        ),
        undefined
      );

      assert.ok(
        (await f.db.deletionLedger()).some((row) => row.userId === actor.userId)
      );

      const restoredId = randomUUID();
      await f.db.repository.transaction((tx) =>
        tx.insert("users", {
          id: restoredId,
          participantSeed: "11".repeat(32),
          admin: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        })
      );

      await f.db.replayErasures([restoredId]);
      assert.equal(
        await f.db.repository.transaction((tx) => tx.get("users", restoredId)),
        undefined
      );

      await f.db.replayErasures([restoredId]);
      const replacement = await f.signup();
      assert.notEqual(
        (await f.auth.authenticate(replacement.token)).userId,
        actor.userId
      );
    } finally {
      await jobs.close();
      await f.db.close();
    }
  }
);
