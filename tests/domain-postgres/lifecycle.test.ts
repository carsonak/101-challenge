/** @file PostgreSQL lifecycle, sparse completion, same-day edits and corrections retain completion. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL lifecycle, sparse completion, same-day edits and corrections retain completion",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const sourceBefore = await f.tracker.source(f.user, f.attemptId);
      for (let index = 0; index < 101; index++) {
        if (index) f.advance(2);

        await f.submit(index);
      }

      let source = await f.tracker.source(f.user, f.attemptId);
      assert.equal(source.status, "completed");
      assert.equal(source.reports.length, 101);
      assert.equal(source.completion?.reportingDates.length, 101);
      assert.equal(source.baseSeed, sourceBefore.baseSeed);
      const entitlement = source.completion;
      const final = required(
        source.reports.find((r) => r.reportingIndex === 101)
      );

      await f.tracker.execute(
        f.user,
        {
          command: "EditReport",
          reportId: final.id,
          expectedReportVersion: 0,
          body: "Same-day final correction",
          goalValues: [],
        },
        randomUUID()
      );

      f.advance();
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "EditReport",
            reportId: final.id,
            expectedReportVersion: 1,
            body: "Too late",
            goalValues: [],
          },
          randomUUID()
        ),
        { code: "ATTEMPT_CLOSED" }
      );

      const grant = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "single_report",
          reportId: final.id,
        },
        randomUUID()
      );

      assert.ok(grant.rawKey);
      const attempts = await Promise.allSettled(
        [1, 2].map(() =>
          f.tracker.execute(
            f.user,
            {
              command: "CorrectReport",
              reportId: final.id,
              expectedReportVersion: 1,
              body: "Authorized replacement",
              goalValues: [],
              key: grant.rawKey,
            },
            randomUUID()
          )
        )
      );

      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      source = await f.tracker.source(f.user, f.attemptId);
      assert.deepEqual(source.completion, entitlement);
      assert.equal(source.reports.length, 101);
      assert.equal(source.sourceVersion, 104);
      const history = await f.tracker.history(f.user);
      const e = required(history[0]);
      const a = required(e.attempts[0]);
      const restart = await f.tracker.execute(
        f.user,
        {
          ...f.setup,
          command: "RestartAttempt",
          expectedEnrollmentVersion: e.version,
          attemptId: a.attemptId,
          expectedAttemptVersion: a.version,
          confirmed: true,
        },
        randomUUID()
      );

      const next = await f.tracker.source(f.user, restart.resourceId);
      assert.equal(next.attemptMode, "progress_only");
      assert.notEqual(next.baseSeed, source.baseSeed);
      assert.equal(next.reports.length, 0);
      assert.equal(
        required((await f.tracker.history(f.user))[0]).attempts.length,
        2
      );

      const admin = JSON.stringify(await f.tracker.adminStats(f.admin));
      assert.equal(admin.includes("Authorized replacement"), false);
      assert.equal(admin.includes(source.baseSeed), false);
      assert.equal(admin.includes(required(grant.rawKey)), false);
      await assert.rejects(f.tracker.source(f.admin, f.attemptId), {
        code: "NOT_FOUND",
      });
    } finally {
      await f.db.close();
    }
  }
);
