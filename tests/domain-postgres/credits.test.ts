/** @file PostgreSQL credits survive separate runs, expire on pause and expire on retained restart. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, required, url } from "./fixtures.js";
test(
  "PostgreSQL credits survive separate runs, expire on pause and expire on retained restart",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      for (let i = 0; i < 14; i++) {
        if (i) f.advance(i === 7 ? 3 : 1);

        await f.submit(i);
      }

      let e = required((await f.tracker.history(f.user))[0]);
      assert.equal(required(e.attempts[0]).rerollCredits, 2);
      await f.tracker.execute(
        f.user,
        {
          command: "PauseEnrollment",
          enrollmentId: f.enrollmentId,
          expectedEnrollmentVersion: e.version,
        },
        randomUUID()
      );

      e = required((await f.tracker.history(f.user))[0]);
      assert.equal(required(e.attempts[0]).rerollCredits, 0);
      await f.tracker.execute(
        f.user,
        {
          command: "ResumeEnrollment",
          enrollmentId: f.enrollmentId,
          expectedEnrollmentVersion: e.version,
        },
        randomUUID()
      );

      e = required((await f.tracker.history(f.user))[0]);
      await f.tracker.execute(
        f.user,
        {
          ...f.setup,
          command: "RestartAttempt",
          attemptId: f.attemptId,
          expectedAttemptVersion: required(e.attempts[0]).version,
          expectedEnrollmentVersion: e.version,
          confirmed: true,
        },
        randomUUID()
      );

      e = required((await f.tracker.history(f.user))[0]);
      assert.equal(e.attempts.length, 2);
      assert.equal(
        e.attempts.find((a) => a.attemptId === f.attemptId)?.reportingDays,
        14
      );

      assert.ok(e.attempts.every((a) => a.rerollCredits === 0));
    } finally {
      await f.db.close();
    }
  }
);
