/** @file QA backfill counts filled dates only, reorders history, enforces bounds and revocation. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, url } from "./fixtures.js";
test(
  "QA backfill counts filled dates only, reorders history, enforces bounds and revocation",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      f.set("2026-01-05T09:00:00.000Z");
      await assert.rejects(
        f.tracker.execute(
          f.admin,
          {
            command: "BackdateEnrollment",
            userId: f.user,
            seasonId: f.seasonId,
            registeredDate: "2025-12-31",
          },
          randomUUID()
        ),
        { code: "BACKDATE_DATE_INVALID" }
      );

      await f.tracker.execute(
        f.admin,
        {
          command: "BackdateEnrollment",
          userId: f.user,
          seasonId: f.seasonId,
          registeredDate: "2026-01-02",
        },
        randomUUID()
      );

      let { a } = await f.current();
      assert.equal(a.reportingDays, 0);
      assert.equal(a.backfillUntil, "2026-01-06T09:00:00.000Z");
      for (const date of ["2026-01-04", "2026-01-02", "2026-01-03"]) {
        ({ a } = await f.current());
        await f.tracker.execute(
          f.user,
          {
            command: "BackfillReport",
            attemptId: a.attemptId,
            expectedAttemptVersion: a.version,
            reportingDate: date,
            body: "Backfilled",
            goalValues: [],
          },
          randomUUID()
        );
      }

      ({ a } = await f.current());
      assert.deepEqual(
        a.reports.map((r) => r.reportingDate),
        ["2026-01-02", "2026-01-03", "2026-01-04"]
      );

      assert.equal(a.reportingDays, 3);
      const report = a.reports[0];
      assert.ok(report);
      const grant = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "attempt_window",
          attemptId: a.attemptId,
          durationMinutes: 60,
        },
        randomUUID()
      );

      const correction = {
        command: "CorrectReport",
        reportId: report.id,
        expectedReportVersion: report.version,
        key: grant.rawKey,
        body: "Corrected",
        goalValues: [],
      };

      for (const date of ["2026-01-01", "2026-01-03", "2026-01-06"])
        await assert.rejects(
          f.tracker.execute(
            f.user,
            { ...correction, reportingDate: date },
            randomUUID()
          )
        );

      await f.tracker.execute(
        f.user,
        { ...correction, reportingDate: "2026-01-05" },
        randomUUID()
      );

      ({ a } = await f.current());
      assert.deepEqual(
        a.reports.map((r) => r.reportingDate),
        ["2026-01-03", "2026-01-04", "2026-01-05"]
      );

      assert.equal(a.currentStreak, 3);
      const stats = await f.tracker.adminStats(f.admin);
      const window = stats.grants.find(
        (g) => g.attemptId === a.attemptId && g.kind === "backfill"
      );

      assert.ok(window);
      await f.tracker.execute(
        f.admin,
        { command: "RevokeCorrectionGrant", grantId: window.id },
        randomUUID()
      );

      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "BackfillReport",
            attemptId: a.attemptId,
            expectedAttemptVersion: a.version,
            reportingDate: "2026-01-02",
            body: "Too late",
            goalValues: [],
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );
    } finally {
      await f.close();
    }
  }
);
