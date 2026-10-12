/** @file PostgreSQL restart/report race, credits, locked milestones and rollback. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL restart/report race, credits, locked milestones and rollback",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      for (let index = 0; index < 7; index++) {
        if (index) f.advance();

        await f.submit(index);
      }

      const source = await f.tracker.source(f.user, f.attemptId);
      assert.equal(
        required(
          required(source.reports.find((r) => r.reportingIndex === 7))
            .milestoneFacts[0]
        ).achieved,
        true
      );

      let history = required((await f.tracker.history(f.user))[0]);
      assert.equal(required(history.attempts[0]).rerollCredits, 1);
      const a = required(history.attempts[0]);
      const milestone = required(a.milestones[0]);
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "ArchiveMilestone",
            attemptId: f.attemptId,
            expectedAttemptVersion: 7,
            milestoneId: milestone.id,
          },
          randomUUID()
        ),
        { code: "MILESTONE_LOCKED" }
      );

      f.advance();
      const contenders = await Promise.allSettled([
        f.submit(7),
        f.tracker.execute(
          f.user,
          {
            ...f.setup,
            command: "RestartAttempt",
            expectedEnrollmentVersion: history.version,
            attemptId: f.attemptId,
            expectedAttemptVersion: 7,
            confirmed: true,
          },
          randomUUID()
        ),
      ]);

      assert.equal(
        contenders.filter((r) => r.status === "fulfilled").length,
        1
      );

      const marker = randomUUID();
      await assert.rejects(
        f.db.repository.transaction(async (tx) => {
          await tx.insert("audit", {
            id: marker,
            actorId: f.user,
            action: "rollback",
            aggregateId: f.attemptId,
            occurredAt: "2026-01-01T00:00:00Z",
          });

          throw new Error("deliberate rollback");
        })
      );

      assert.equal(
        await f.db.repository.transaction((tx) => tx.get("audit", marker)),
        undefined
      );

      history = required((await f.tracker.history(f.user))[0]);
      assert.ok(required(history.attempts[0]).reportingDays >= 7);
    } finally {
      await f.db.close();
    }
  }
);
