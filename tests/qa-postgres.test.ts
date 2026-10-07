/**
 * @file QA lifecycle/account regression checks on a disposable PostgreSQL database.
 * Uses fictional data, deterministic clocks and real restricted-role transactions.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createAuth,
  createTracker,
  type AuthMail,
} from "../packages/core/src/index.js";
import { createRepository } from "../packages/db/src/index.js";

/** Explicit integration opt-in, never a participant database. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");
/** Fictional strong password shared only by this test module. */
const password = "fictional QA password 123";
/** Fixture owns its connections and deterministic current instant. */
async function fixture() {
  assert.ok(url);
  const db = createRepository(url);
  await db.migrate();
  const app = createRepository(url, true);
  let now = new Date("2026-01-01T09:00:00.000Z");
  const tracker = createTracker(app.repository, { now: () => now });
  const mails: AuthMail[] = [];
  const auth = createAuth(app.repository, {
    now: () => now,
    sendMail: async (mail) => {
      mails.push(mail);
    },
  });
  const admin = await tracker.createUser(true),
    user = await tracker.createUser();
  const slug = `qa-${randomUUID()}`;
  const season = await tracker.execute(
    admin,
    { command: "CreateSeason", slug, title: "QA season" },
    randomUUID()
  );
  await tracker.execute(
    admin,
    {
      command: "SaveSeasonTemplate",
      seasonId: season.resourceId,
      expectedSeasonVersion: 0,
      goals: [{ title: "Practise", kind: "qualitative" }],
      milestones: [
        {
          title: "First report",
          targetReportingDay: 1,
          achievementKind: "reporting_count",
        },
      ],
    },
    randomUUID()
  );
  await tracker.execute(
    admin,
    {
      command: "PublishSeason",
      seasonId: season.resourceId,
      expectedSeasonVersion: 1,
    },
    randomUUID()
  );
  return {
    db,
    app,
    tracker,
    auth,
    mails,
    admin,
    user,
    slug,
    seasonId: season.resourceId,
    set(date: string) {
      now = new Date(date);
    },
    async close() {
      await app.close();
      await db.close();
    },
    async signup() {
      const email = `${randomUUID()}@example.test`,
        username = `qa-${randomUUID().slice(0, 20)}`;
      await auth.execute({ action: "signup", username, email, password });
      const proof = mails.at(-1);
      assert.ok(proof);
      await auth.execute({ action: "verify", token: proof.token });
      const session = await auth.execute({ action: "login", email, password });
      assert.ok("token" in session && session.token && session.csrf);
      return { email, username, token: session.token, csrf: session.csrf };
    },
    async current() {
      const e = (await tracker.history(user))[0];
      assert.ok(e);
      const a = e.attempts.find((a) => a.attemptId === e.currentAttemptId);
      assert.ok(a);
      return { e, a };
    },
  };
}

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
        { code: "VALIDATION" }
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

test(
  "QA usernames, recovery-only sessions, deletion email retries and atomic restoration",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owner = await f.signup();
      const account = await f.auth.account(owner.token);
      assert.equal(account.username, owner.username);
      assert.equal(account.recoveryEmail, owner.email);
      const competitor = await f.signup();
      await assert.rejects(
        f.auth.execute(
          { action: "save_profile", username: owner.username.toUpperCase() },
          competitor.token,
          competitor.csrf
        ),
        { code: "VALIDATION" }
      );
      await assert.rejects(
        f.auth.execute(
          {
            action: "request_erasure",
            confirmed: true,
            username: "not-the-owner",
          },
          owner.token,
          owner.csrf
        ),
        { code: "VALIDATION" }
      );
      const request = await f.auth.execute(
        {
          action: "request_erasure",
          confirmed: true,
          username: owner.username,
        },
        owner.token,
        owner.csrf
      );
      assert.ok("requestId" in request);
      await assert.rejects(f.auth.authenticate(owner.token), {
        code: "UNAUTHENTICATED",
      });
      const session = await f.auth.execute({
        action: "login",
        email: owner.email,
        password,
      });
      assert.ok("token" in session && session.token && session.csrf);
      assert.ok((await f.auth.account(session.token)).deletion);
      await assert.rejects(f.auth.authenticate(session.token), {
        code: "FORBIDDEN",
      });
      await assert.rejects(f.tracker.history(account.id), {
        code: "FORBIDDEN",
      });
      // Keep the privileged maintenance clock from erasing the fictional historic request while testing delivery.
      await f.db.repository.transaction(async (tx) => {
        const r = await tx.get(
          "erasure_requests",
          String(request.requestId),
          true
        );
        assert.ok(r);
        r.deleteAfter = "2099-01-01T00:00:00.000Z";
        await tx.save("erasure_requests", r);
      });
      let deliveries = 0;
      await f.db.maintainAccounts(
        async () => {
          deliveries++;
          throw new Error("SMTP unavailable");
        },
        undefined,
        String(request.requestId)
      );
      const job = (
        await f.db.repository.transaction((tx) =>
          tx.list("account_mail", { userId: account.id })
        )
      )[0];
      assert.ok(job);
      assert.equal(job.failures, 1);
      assert.equal(deliveries, 1);
      await f.db.repository.transaction(async (tx) => {
        job.nextAttemptAt = "2000-01-01T00:00:00.000Z";
        await tx.save("account_mail", job);
      });
      await f.db.maintainAccounts(
        async (recipient) => {
          assert.equal(recipient, owner.email);
          deliveries++;
        },
        undefined,
        String(request.requestId)
      );
      assert.equal(deliveries, 2);
      const restore = await f.auth.execute(
        { action: "restore_account" },
        session.token,
        session.csrf
      );
      assert.ok("token" in restore && restore.token);
      assert.equal((await f.auth.account(restore.token)).deletion, null);
      await assert.rejects(
        f.db.eraseAccount(account.id, String(request.requestId)),
        { code: "42501" }
      );
      const notices = await f.auth.notifications(restore.token);
      assert.ok(Array.isArray(notices));
      const sessions = await f.auth.sessions(restore.token);
      assert.ok(sessions.some((s) => s.current));
    } finally {
      await f.close();
    }
  }
);

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

test(
  "QA provider-only recovery email proofs and cross-owner session/notification checks",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const browser = "a".repeat(64),
        begin = await f.auth.beginOAuth("discord", browser),
        state = await f.auth.oauthState("discord", begin.state, browser);
      const provider = await f.auth.completeOAuth(state.id, browser, {
        provider: "discord",
        subject: randomUUID(),
        username: `discord-${randomUUID().slice(0, 15)}`,
        avatar: "https://cdn.discordapp.com/avatars/1/test.png",
      });
      const profile = await f.auth.account(provider.token);
      assert.match(profile.username, /^discord-/);
      assert.ok(profile.avatar);
      await assert.rejects(
        f.auth.execute(
          {
            action: "request_erasure",
            username: profile.username,
            confirmed: true,
          },
          provider.token,
          provider.csrf
        ),
        { code: "VALIDATION" }
      );
      await f.auth.execute(
        { action: "recovery_email", email: "first@example.test" },
        provider.token,
        provider.csrf
      );
      const first = f.mails.at(-1);
      assert.ok(first);
      await f.auth.execute(
        { action: "recovery_email", email: "second@example.test" },
        provider.token,
        provider.csrf
      );
      const second = f.mails.at(-1);
      assert.ok(second);
      await assert.rejects(
        f.auth.execute({ action: "verify_recovery_email", token: first.token }),
        { code: "UNAUTHENTICATED" }
      );
      await f.auth.execute({
        action: "verify_recovery_email",
        token: second.token,
      });
      assert.equal(
        (await f.auth.account(provider.token)).recoveryEmail,
        "second@example.test"
      );
      const other = await f.signup();
      const sessions = await f.auth.sessions(provider.token);
      assert.ok(sessions[0]);
      await assert.rejects(
        f.auth.execute(
          { action: "revoke_session", sessionId: sessions[0].id },
          other.token,
          other.csrf
        ),
        { code: "NOT_FOUND" }
      );
      const noticeId = randomUUID();
      await f.db.repository.transaction((tx) =>
        tx.insert("notifications", {
          id: noticeId,
          userId: profile.id,
          message: "Test notice",
          href: "/home",
          createdAt: "2026-01-01T09:00:00.000Z",
          readAt: null,
          dismissedAt: null,
        })
      );
      await assert.rejects(
        f.auth.execute(
          { action: "notification", id: noticeId, dismiss: true },
          other.token,
          other.csrf
        ),
        { code: "NOT_FOUND" }
      );
      await f.auth.execute(
        { action: "notification", id: noticeId, dismiss: true },
        provider.token,
        provider.csrf
      );
      assert.equal((await f.auth.notifications(provider.token)).length, 0);
    } finally {
      await f.close();
    }
  }
);

test(
  "QA concurrent username claims and exact deletion deadline reject recovery safely",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const username = `race-${randomUUID().slice(0, 15)}`;
      const claims = await Promise.allSettled(
        [0, 1].map((i) =>
          f.auth.execute({
            action: "signup",
            username: i ? username.toUpperCase() : username,
            email: `${randomUUID()}@example.test`,
            password,
          })
        )
      );
      assert.equal(claims.filter((r) => r.status === "fulfilled").length, 1);
      const owner = await f.signup();
      const id = (await f.auth.account(owner.token)).id;
      const request = await f.auth.execute(
        {
          action: "request_erasure",
          username: owner.username,
          confirmed: true,
        },
        owner.token,
        owner.csrf
      );
      assert.ok("requestId" in request);
      const session = await f.auth.execute({
        action: "login",
        email: owner.email,
        password,
      });
      assert.ok("token" in session && session.token && session.csrf);
      const deadline = "2026-01-08T09:00:00.000Z";
      f.set(deadline);
      const race = await Promise.allSettled([
        f.auth.execute(
          { action: "restore_account" },
          session.token,
          session.csrf
        ),
        f.db.eraseAccount(id, String(request.requestId)),
      ]);
      assert.equal(race[0]?.status, "rejected");
      assert.equal(race[1]?.status, "fulfilled");
      assert.equal(
        await f.db.repository.transaction((tx) => tx.get("users", id)),
        undefined
      );
    } finally {
      await f.close();
    }
  }
);
