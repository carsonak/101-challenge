/** @file PostgreSQL milestone revision races its target report without changing accepted facts. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL milestone revision races its target report without changing accepted facts",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      for (let i = 0; i < 6; i++) {
        await f.submit(i);
        f.advance();
      }

      const a = required(
          required((await f.tracker.history(f.user))[0]).attempts[0]
        ),
        m = required(a.milestones[0]);

      const revision = {
        command: "SaveMilestone",
        attemptId: f.attemptId,
        expectedAttemptVersion: 6,
        milestoneId: m.id,
        milestone: {
          title: "Revised before acceptance",
          targetReportingDay: 7,
          achievementKind: "reporting_count",
        },
      };

      const outcomes = await Promise.allSettled([
        f.submit(6),
        f.tracker.execute(f.user, revision, randomUUID()),
      ]);

      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      if (outcomes[0].status === "rejected") await f.submit(7);

      const after = required(
        required((await f.tracker.history(f.user))[0]).attempts[0]
      );

      assert.equal(after.reportingDays, 7);
      assert.equal(required(after.milestones[0]).locked, true);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          { ...revision, expectedAttemptVersion: after.version },
          randomUUID()
        ),
        { code: "MILESTONE_LOCKED" }
      );

      const source = await f.tracker.source(f.user, f.attemptId),
        report = required(source.reports.find((r) => r.reportingIndex === 7));

      assert.equal(
        required(report.milestoneFacts[0]).input.title,
        outcomes[1].status === "fulfilled"
          ? "Revised before acceptance"
          : "First seven reports"
      );
    } finally {
      await f.db.close();
    }
  }
);
