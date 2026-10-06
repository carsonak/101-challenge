/**
 * @file Real PostgreSQL transaction/constraint tests with fictional accounts.
 * Set TRACKER_TEST_DATABASE_URL to an isolated database ending in _test or _ci.
 * Applies migrations and retains fictional test rows; never targets participant data.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createTracker } from "../packages/core/src/index.js";
import { createRepository } from "../packages/db/src/index.js";

/** Explicit isolated database opt-in; ordinary unit checks skip integrations. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Integration database must end in _test or _ci");

/** Assert fixture existence at runtime so a missing record fails clearly. */
function required<T>(value: T | null | undefined): T {
  assert.ok(value !== undefined && value !== null);
  return value;
}

/** Create a fictional test service with deterministic clock and real repository. */
async function fixture() {
  const db = createRepository(required(url));
  await db.migrate();
  let instant = new Date("2026-01-01T09:00:00Z");
  const tracker = createTracker(db.repository, { now: () => instant });
  const admin = await tracker.createUser(true),
    user = await tracker.createUser();
  const create = await tracker.execute(
    admin,
    { command: "CreateSeason", title: "Fictional practice" },
    randomUUID()
  );
  await tracker.execute(
    admin,
    {
      command: "PublishSeason",
      seasonId: create.resourceId,
      expectedSeasonVersion: 0,
    },
    randomUUID()
  );
  const enroll = await tracker.execute(
    user,
    { command: "Enroll", seasonId: create.resourceId },
    randomUUID()
  );
  const setup = {
    command: "StartAttempt",
    enrollmentId: enroll.resourceId,
    expectedEnrollmentVersion: 0,
    timezone: "Africa/Nairobi",
    goals: [{ title: "Practice", kind: "count", target: "10" }],
    milestones: [
      {
        title: "First seven reports",
        targetReportingDay: 7,
        achievementKind: "reporting_count",
      },
    ],
  };
  const start = await tracker.execute(user, setup, randomUUID());
  return {
    db,
    tracker,
    admin,
    user,
    seasonId: create.resourceId,
    enrollmentId: enroll.resourceId,
    attemptId: start.resourceId,
    setup,
    advance(days = 1) {
      instant = new Date(instant.getTime() + days * 86400000);
    },
    setInstant(value: string) {
      instant = new Date(value);
    },
    async submit(version: number, key = randomUUID()) {
      return tracker.execute(
        user,
        {
          command: "SubmitReport",
          attemptId: start.resourceId,
          expectedAttemptVersion: version,
          body: "Fictional progress",
          goalValues: [],
        },
        key
      );
    },
  };
}

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
test(
  "PostgreSQL slot races, replay conflicts, cancellation and retained restart",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const second = await f.tracker.execute(
        f.admin,
        { command: "CreateSeason", title: "Second fictional season" },
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
          command: "CancelEnrollment",
          enrollmentId: f.enrollmentId,
          expectedEnrollmentVersion: 1,
        },
        randomUUID()
      );
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

test(
  "PostgreSQL credits survive separate runs/cancellation and expire on retained restart",
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
          command: "CancelEnrollment",
          enrollmentId: f.enrollmentId,
          expectedEnrollmentVersion: e.version,
        },
        randomUUID()
      );
      e = required((await f.tracker.history(f.user))[0]);
      assert.equal(required(e.attempts[0]).rerollCredits, 2);
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
test(
  "PostgreSQL grant expiry/revocation and cross-attempt values reject atomically",
  { skip: !url },
  async () => {
    const f = await fixture(),
      other = await fixture();
    try {
      const accepted = await f.submit(0);
      const window = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "attempt_window",
          attemptId: f.attemptId,
          durationMinutes: 60,
        },
        randomUUID()
      );
      f.setInstant("2026-01-01T10:00:00Z");
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CorrectReport",
            reportId: accepted.resourceId,
            expectedReportVersion: 0,
            body: "Expired",
            goalValues: [],
            key: window.rawKey,
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );
      const grant = await f.tracker.execute(
        f.admin,
        {
          command: "IssueCorrectionGrant",
          kind: "single_report",
          reportId: accepted.resourceId,
        },
        randomUUID()
      );
      await f.tracker.execute(
        f.admin,
        { command: "RevokeCorrectionGrant", grantId: grant.resourceId },
        randomUUID()
      );
      await assert.rejects(
        f.tracker.execute(
          f.user,
          {
            command: "CorrectReport",
            reportId: accepted.resourceId,
            expectedReportVersion: 0,
            body: "Revoked",
            goalValues: [],
            key: grant.rawKey,
          },
          randomUUID()
        ),
        { code: "GRANT_INVALID" }
      );
      const foreign = required(
        required((await other.tracker.history(other.user))[0]).attempts[0]
      ).goalRevisions[0];
      const saved = await f.db.repository.transaction((tx) =>
        tx.get("reports", accepted.resourceId)
      );
      await assert.rejects(
        f.db.repository.transaction((tx) =>
          tx.save("reports", {
            ...required(saved),
            goalValues: [{ goalRevisionId: required(foreign).id, value: "1" }],
          })
        ),
        { code: "23503" }
      );
      assert.equal(
        (await f.tracker.source(f.user, f.attemptId)).reports[0]?.body,
        "Fictional progress"
      );
    } finally {
      await f.db.close();
      await other.db.close();
    }
  }
);
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
