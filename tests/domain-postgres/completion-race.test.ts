/** @file PostgreSQL 101st report vs restart preserves one entitlement and all history. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL 101st report vs restart preserves one entitlement and all history",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      for (let i = 0; i < 100; i++) {
        if (i) f.advance();

        await f.submit(i);
      }

      f.advance();
      const e = required((await f.tracker.history(f.user))[0]);
      const contenders = await Promise.allSettled([
        f.submit(100),
        f.tracker.execute(
          f.user,
          {
            ...f.setup,
            command: "RestartAttempt",
            attemptId: f.attemptId,
            expectedAttemptVersion: 100,
            expectedEnrollmentVersion: e.version,
            confirmed: true,
          },
          randomUUID()
        ),
      ]);

      assert.equal(
        contenders.filter((r) => r.status === "fulfilled").length,
        1
      );

      const source = await f.tracker.source(f.user, f.attemptId);
      assert.ok(source.reports.length === 100 || source.reports.length === 101);
      assert.equal(source.completion !== null, source.reports.length === 101);
      const events = await f.db.repository.transaction((tx) =>
        tx.list("outbox", { aggregateId: f.attemptId })
      );

      assert.equal(
        Math.max(...events.map((event) => event.sourceVersion)),
        source.sourceVersion
      );
    } finally {
      await f.db.close();
    }
  }
);
