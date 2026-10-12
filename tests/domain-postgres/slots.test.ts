/** @file PostgreSQL slot races, replay conflicts, cancellation and retained restart. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, url } from "./fixtures.js";
test(
  "PostgreSQL slot races, replay conflicts, cancellation and retained restart",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const second = await f.tracker.execute(
        f.admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Second fictional season",
        },
        randomUUID()
      );

      await f.tracker.execute(
        f.admin,
        {
          command: "PublishSeason",
          seasonId: second.resourceId,
          expectedSeasonVersion: 0,
        },
        randomUUID()
      );

      await assert.rejects(
        f.tracker.execute(
          f.user,
          { command: "Enroll", seasonId: second.resourceId },
          randomUUID()
        ),
        { code: "SEASON_SLOT_OCCUPIED" }
      );

      assert.equal((await f.tracker.history(f.user)).length, 1);
      const key = randomUUID();
      const first = await f.submit(0, key);
      assert.deepEqual(await f.submit(0, key), { ...first, replayed: true });
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "SubmitReport",
            attemptId: f.attemptId,
            expectedAttemptVersion: 0,
            body: "Different private text",
            goalValues: [],
          },
          key
        ),
        { code: "IDEMPOTENCY_CONFLICT" }
      );

      const cancel = await f.tracker.execute(
        f.user,
        {
          command: "PauseEnrollment",
          enrollmentId: f.enrollmentId,
          expectedEnrollmentVersion: 1,
        },
        randomUUID()
      );

      f.advance();
      const contenders = await Promise.allSettled([
        f.tracker.execute(
          f.user,
          {
            command: "ResumeEnrollment",
            enrollmentId: f.enrollmentId,
            expectedEnrollmentVersion: cancel.version,
          },
          randomUUID()
        ),
        f.tracker.execute(
          f.user,
          { command: "Enroll", seasonId: second.resourceId },
          randomUUID()
        ),
      ]);

      assert.equal(
        contenders.filter((r) => r.status === "fulfilled").length,
        1
      );

      assert.equal(
        (
          await f.db.repository.transaction((tx) =>
            tx.list("slots", { id: f.user })
          )
        ).length,
        1
      );

      const outsider = await f.tracker.createUser();
      await assert.rejects(
        f.tracker.execute(
          outsider,
          {
            command: "EditReport",
            reportId: first.resourceId,
            expectedReportVersion: 0,
            body: "Forged",
            goalValues: [],
          },
          randomUUID()
        ),
        { code: "NOT_FOUND" }
      );
    } finally {
      await f.db.close();
    }
  }
);
