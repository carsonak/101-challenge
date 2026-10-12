/** @file QA 24-hour expiry, historical 101st report, stable entitlement and cancelled retry. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, url } from "./fixtures.js";
test(
  "QA 24-hour expiry, historical 101st report, stable entitlement and cancelled retry",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      f.set("2026-04-12T09:00:00.000Z");
      await f.tracker.execute(
        f.admin,
        {
          command: "BackdateEnrollment",
          userId: f.user,
          seasonId: f.seasonId,
          registeredDate: "2026-01-01",
        },
        randomUUID()
      );

      for (let i = 100; i >= 0; i--) {
        const { a } = await f.current();
        const date = new Date(Date.UTC(2026, 0, 1 + i))
          .toISOString()
          .slice(0, 10);

        await f.tracker.execute(
          f.user,
          {
            command: "BackfillReport",
            attemptId: a.attemptId,
            expectedAttemptVersion: a.version,
            reportingDate: date,
            body: "Fictional historic report",
            goalValues: [],
          },
          randomUUID()
        );
      }

      let { e, a } = await f.current();
      assert.equal(a.reportingDays, 101);
      assert.equal(a.attemptState, "completed");
      assert.equal(e.completion?.reportingDates[0], "2026-01-01");
      const entitlement = e.completion?.id;
      const last = a.reports.at(-1);
      assert.ok(last);
      await f.tracker.execute(
        f.user,
        {
          command: "CorrectReport",
          reportId: last.id,
          expectedReportVersion: last.version,
          reportingDate: "2026-04-12",
          body: "Corrected within window",
          goalValues: [],
        },
        randomUUID()
      );

      ({ e, a } = await f.current());
      assert.equal(e.completion?.id, entitlement);
      f.set("2026-04-13T09:00:00.000Z");
      const changed = a.reports.at(-1);
      assert.ok(changed);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CorrectReport",
            reportId: changed.id,
            expectedReportVersion: changed.version,
            body: "Expired window",
            goalValues: [],
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );

      const newAttempt = await f.tracker.execute(
        f.user,
        {
          command: "RestartAttempt",
          enrollmentId: e.id,
          expectedEnrollmentVersion: e.version,
          attemptId: a.attemptId,
          expectedAttemptVersion: a.version,
          confirmed: true,
          goals: [{ title: "Retry", kind: "qualitative" }],
        },
        randomUUID()
      );

      ({ e, a } = await f.current());
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
      assert.equal(e.completion?.id, entitlement);
      assert.equal(a.attemptId, newAttempt.resourceId);
      assert.equal(a.erased, true);
      await f.tracker.execute(
        f.user,
        {
          command: "RestartAttempt",
          enrollmentId: e.id,
          expectedEnrollmentVersion: e.version,
          attemptId: a.attemptId,
          expectedAttemptVersion: a.version,
          confirmed: true,
          goals: [{ title: "Retry again", kind: "qualitative" }],
        },
        randomUUID()
      );

      assert.equal((await f.current()).a.mode, "progress_only");
    } finally {
      await f.close();
    }
  }
);
