/** @file QA metadata identifiers, server timezone, pause cooldown and typed erasure. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, url } from "./fixtures.js";
test(
  "QA metadata identifiers, server timezone, pause cooldown and typed erasure",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      await assert.rejects(
        f.tracker.execute(
          f.admin,
          {
            command: "SaveSeason",
            seasonId: f.seasonId,
            expectedSeasonVersion: 2,
            title: "Changed",
            description: "Description",
            slug: "changed",
          },
          randomUUID()
        ),
        { code: "FORBIDDEN" }
      );

      await f.tracker.execute(
        f.admin,
        {
          command: "SaveSeason",
          seasonId: f.seasonId,
          expectedSeasonVersion: 2,
          title: "Changed",
          description: "Editable",
          slug: f.slug,
        },
        randomUUID()
      );

      const join = await f.tracker.execute(
        f.user,
        { command: "Enroll", seasonId: f.seasonId },
        randomUUID()
      );

      const setup = {
        command: "StartAttempt",
        enrollmentId: join.resourceId,
        expectedEnrollmentVersion: 0,
        goals: [{ title: "Practise", kind: "qualitative" }],
      };

      await assert.rejects(
        f.tracker.execute(f.user, { ...setup, timezone: "UTC" }, randomUUID()),
        { code: "VALIDATION" }
      );

      await f.tracker.execute(f.user, setup, randomUUID());
      for (let day = 1; day <= 7; day++) {
        f.set(`2026-01-0${day}T09:00:00.000Z`);
        const { a } = await f.current();
        await f.tracker.execute(
          f.user,
          {
            command: "SubmitReport",
            attemptId: a.attemptId,
            expectedAttemptVersion: a.version,
            body: "Practice",
            goalValues: [],
          },
          randomUUID()
        );
      }

      let { e, a } = await f.current();
      assert.equal(e.timezone, "Africa/Nairobi");
      assert.equal(a.rerollCredits, 1);
      const other = await f.tracker.execute(
        f.admin,
        {
          command: "CreateSeason",
          title: "Other",
          slug: `other-${randomUUID()}`,
        },
        randomUUID()
      );

      await f.tracker.execute(
        f.admin,
        {
          command: "PublishSeason",
          seasonId: other.resourceId,
          expectedSeasonVersion: 0,
        },
        randomUUID()
      );

      await f.tracker.execute(
        f.user,
        {
          command: "PauseEnrollment",
          enrollmentId: e.id,
          expectedEnrollmentVersion: e.version,
        },
        randomUUID()
      );

      ({ e, a } = await f.current());
      assert.equal(a.currentStreak, 0);
      assert.equal(a.longestStreak, 7);
      assert.equal(a.rerollCredits, 0);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          { command: "Enroll", seasonId: other.resourceId },
          randomUUID()
        ),
        { code: "SEASON_SLOT_OCCUPIED" }
      );

      await f.tracker.execute(
        f.user,
        {
          command: "ResumeEnrollment",
          enrollmentId: e.id,
          expectedEnrollmentVersion: e.version,
        },
        randomUUID()
      );

      ({ e, a } = await f.current());
      assert.equal(a.currentStreak, 0);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CancelEnrollment",
            enrollmentId: e.id,
            expectedEnrollmentVersion: e.version,
            seasonSlug: "wrong",
            erase: true,
          },
          randomUUID()
        ),
        { code: "VALIDATION" }
      );

      await f.tracker.execute(
        f.user,
        {
          command: "CancelEnrollment",
          enrollmentId: e.id,
          expectedEnrollmentVersion: e.version,
          seasonSlug: f.slug,
          erase: true,
        },
        randomUUID()
      );

      ({ e, a } = await f.current());
      assert.equal(a.reports.length, 0);
      assert.equal(a.goals.length, 0);
      assert.equal(a.erased, true);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "ResumeEnrollment",
            enrollmentId: e.id,
            expectedEnrollmentVersion: e.version,
          },
          randomUUID()
        ),
        { code: "ATTEMPT_CLOSED" }
      );

      await assert.rejects(f.tracker.source(f.user, a.attemptId), {
        code: "NOT_FOUND",
      });
    } finally {
      await f.close();
    }
  }
);
