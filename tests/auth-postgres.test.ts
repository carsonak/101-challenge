/**
 * @file Exercises independent authentication, proof replay and erasure on PostgreSQL.
 * Set TRACKER_TEST_DATABASE_URL to a fictional disposable _test/_ci database.
 * Uses a mail transport double, never sends messages to people or live providers.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import {
  createAuth,
  createTracker,
  hashPassword,
  verifyPassword,
  type AuthMail,
} from "../packages/core/src/index.js";
import { createRepository, createJobStore } from "../packages/db/src/index.js";

/** Explicit test target; real participant databases are rejected. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Integration database must end in _test or _ci");
/** Assert fixture existence while preserving its inferred type. */
function required<T>(value: T | null | undefined): T {
  assert.ok(value !== undefined && value !== null);
  return value;
}
/** Fictional account address, unique across repeatable test runs. */
const email = () => `fixture-${randomUUID()}@example.invalid`;
/** Strong fictional test password. */
const password = "fictional correct horse battery";
/** Create isolated service dependencies and inspect only fictional mail deliveries. */
async function fixture() {
  const db = createRepository(required(url));
  await db.migrate();
  const mail: AuthMail[] = [];
  let instant = new Date("2026-10-06T06:00:00Z");
  const auth = createAuth(db.repository, {
    now: () => instant,
    sendMail: async (message) => {
      mail.push(message);
    },
  });
  return {
    db,
    auth,
    mail,
    advance(minutes: number) {
      instant = new Date(instant.getTime() + minutes * 60000);
    },
    async signup() {
      const address = email();
      await auth.execute({ action: "signup", email: address, password });
      const proof = required(mail.at(-1));
      await auth.execute({ action: "verify", token: proof.token });
      const result = await auth.execute({
        action: "login",
        email: address,
        password,
      });
      assert.ok("token" in result && "csrf" in result);
      return {
        address,
        token: required(result.token),
        csrf: required(result.csrf),
      };
    },
  };
}

test("Argon2id salts and verifies without exposing plaintext", async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong password", a), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
  assert.equal(a.includes(password), false);
});

test(
  "PostgreSQL email verification, CSRF, logout and recovery are one-use",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email();
      assert.deepEqual(
        await f.auth.execute({ action: "signup", email: address, password }),
        { accepted: true }
      );
      await assert.rejects(
        f.auth.execute({ action: "login", email: address, password }),
        { code: "UNAUTHENTICATED" }
      );
      const verification = required(f.mail.at(-1));
      await f.auth.execute({ action: "verify", token: verification.token });
      await assert.rejects(
        f.auth.execute({ action: "verify", token: verification.token }),
        { code: "UNAUTHENTICATED" }
      );
      const login = await f.auth.execute({
        action: "login",
        email: address,
        password,
      });
      assert.ok("token" in login && "csrf" in login);
      const token = required(login.token),
        csrf = required(login.csrf);
      const owner = await f.auth.authenticate(token, csrf);
      assert.equal((await f.auth.account(token)).email, address);
      await assert.rejects(f.auth.authenticate(token, "forged"), {
        code: "FORBIDDEN",
      });
      await assert.rejects(f.auth.execute({ action: "logout" }, token), {
        code: "FORBIDDEN",
      });
      const unknown = await f.auth.execute({
        action: "recover",
        email: email(),
      });
      const known = await f.auth.execute({ action: "recover", email: address });
      assert.deepEqual(known, unknown);
      const recovery = required(f.mail.at(-1));
      await f.auth.execute({
        action: "reset",
        token: recovery.token,
        password: "new fictional correct horse battery",
      });
      await assert.rejects(f.auth.authenticate(token), {
        code: "UNAUTHENTICATED",
      });
      await assert.rejects(
        f.auth.execute({ action: "reset", token: recovery.token, password }),
        { code: "UNAUTHENTICATED" }
      );
      await assert.rejects(
        f.auth.execute({ action: "login", email: address, password }),
        { code: "UNAUTHENTICATED" }
      );
      const rows = await f.db.repository.transaction((tx) =>
        tx.list("auth_tokens", { userId: owner.userId })
      );
      assert.equal(JSON.stringify(rows).includes(recovery.token), false);
      assert.equal(JSON.stringify(rows).includes(verification.token), false);
      const fresh = await f.auth.execute({
        action: "login",
        email: address,
        password: "new fictional correct horse battery",
      });
      assert.ok("token" in fresh && "csrf" in fresh);
      await f.auth.execute(
        { action: "logout" },
        required(fresh.token),
        required(fresh.csrf)
      );
      await assert.rejects(f.auth.authenticate(required(fresh.token)), {
        code: "UNAUTHENTICATED",
      });
    } finally {
      await f.db.close();
    }
  }
);
test(
  "PostgreSQL OAuth subjects never merge by email and linking requires both proofs",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owner = await f.signup(),
        original = await f.auth.account(owner.token);
      const browser = randomBytes(32).toString("hex");
      const state = await f.auth.beginOAuth("google", browser);
      const stored = await f.auth.oauthState("google", state.state, browser);
      await assert.rejects(
        f.auth.oauthState("google", state.state, "wrong-browser"),
        { code: "UNAUTHENTICATED" }
      );
      const proof = {
        provider: "google" as const,
        subject: `google-${randomUUID()}`,
        email: owner.address,
      };
      const independent = await f.auth.completeOAuth(stored.id, browser, proof);
      assert.notEqual(
        (await f.auth.account(independent.token)).id,
        original.id
      );
      await assert.rejects(f.auth.completeOAuth(stored.id, browser, proof), {
        code: "UNAUTHENTICATED",
      });
      const link = await f.auth.beginOAuth(
        "google",
        browser,
        owner.token,
        owner.csrf,
        true
      );
      const linkState = await f.auth.oauthState("google", link.state, browser);
      await assert.rejects(
        f.auth.completeOAuth(linkState.id, browser, proof, owner.token),
        { code: "FORBIDDEN" }
      );
      const discord = await f.auth.beginOAuth(
        "discord",
        browser,
        owner.token,
        owner.csrf,
        true
      );
      const discordState = await f.auth.oauthState(
        "discord",
        discord.state,
        browser
      );
      const subject = `discord-${randomUUID()}`;
      const linked = await f.auth.completeOAuth(
        discordState.id,
        browser,
        { provider: "discord", subject },
        owner.token
      );
      assert.equal((await f.auth.account(linked.token)).id, original.id);
      assert.equal(await f.auth.discordActor(subject), original.id);
      await f.auth.execute(
        { action: "unlink", provider: "discord" },
        linked.token,
        linked.csrf
      );
      assert.equal(await f.auth.discordActor(subject), undefined);
      await assert.rejects(
        f.auth.execute(
          { action: "unlink", provider: "email" },
          owner.token,
          owner.csrf
        ),
        { code: "UNAUTHENTICATED" }
      );
      const login = await f.auth.execute({
        action: "login",
        email: owner.address,
        password,
      });
      assert.ok("token" in login && "csrf" in login);
      await assert.rejects(
        f.auth.execute(
          { action: "unlink", provider: "email" },
          required(login.token),
          required(login.csrf)
        ),
        { code: "FORBIDDEN" }
      );
    } finally {
      await f.db.close();
    }
  }
);
test(
  "PostgreSQL OAuth callbacks serialize subject ownership and proof expiry",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const browser = randomBytes(32).toString("hex"),
        subject = `same-subject-${randomUUID()}`;
      const a = await f.auth.beginOAuth("discord", browser),
        b = await f.auth.beginOAuth("discord", browser);
      const aa = await f.auth.oauthState("discord", a.state, browser),
        bb = await f.auth.oauthState("discord", b.state, browser);
      const results = await Promise.all([
        f.auth.completeOAuth(aa.id, browser, { provider: "discord", subject }),
        f.auth.completeOAuth(bb.id, browser, { provider: "discord", subject }),
      ]);
      assert.equal(
        (await f.auth.account(required(results[0]).token)).id,
        (await f.auth.account(required(results[1]).token)).id
      );
      assert.equal(
        (
          await f.db.repository.transaction((tx) =>
            tx.list("identities", { provider: "discord", subject })
          )
        ).length,
        1
      );
      const expired = await f.auth.beginOAuth("google", browser);
      f.advance(10);
      await assert.rejects(
        f.auth.oauthState("google", expired.state, browser),
        { code: "UNAUTHENTICATED" }
      );
      const owner = await f.signup();
      f.advance(10);
      await assert.rejects(
        f.auth.execute(
          { action: "request_erasure", confirmed: true },
          owner.token,
          owner.csrf
        ),
        { code: "FORBIDDEN" }
      );
      await f.auth.execute(
        { action: "reauthenticate", password },
        owner.token,
        owner.csrf
      );
      const request = await f.auth.execute(
        { action: "request_erasure", confirmed: true },
        owner.token,
        owner.csrf
      );
      assert.ok("requestId" in request);
    } finally {
      await f.db.close();
    }
  }
);
test(
  "PostgreSQL privileged erasure removes private graph and revokes sessions",
  { skip: !url },
  async () => {
    const f = await fixture();
    const jobs = createJobStore(required(url));
    try {
      const owner = await f.signup(),
        actor = await f.auth.authenticate(owner.token);
      let reportingInstant = new Date("2026-01-01T09:00:00Z");
      const tracker = createTracker(f.db.repository, {
        now: () => reportingInstant,
      });
      const admin = await tracker.createUser(true);
      const season = await tracker.execute(
        admin,
        { command: "CreateSeason", title: "Erasure fixture" },
        randomUUID()
      );
      await tracker.execute(
        admin,
        {
          command: "PublishSeason",
          seasonId: season.resourceId,
          expectedSeasonVersion: 0,
        },
        randomUUID()
      );
      const enrollment = await tracker.execute(
        actor.userId,
        { command: "Enroll", seasonId: season.resourceId },
        randomUUID()
      );
      const started = await tracker.execute(
        actor.userId,
        {
          command: "StartAttempt",
          enrollmentId: enrollment.resourceId,
          expectedEnrollmentVersion: 0,
          timezone: "Africa/Nairobi",
          goals: [{ title: "Private erasure fixture", kind: "qualitative" }],
        },
        randomUUID()
      );
      for (let version = 0; version < 101; version++) {
        if (version)
          reportingInstant = new Date(reportingInstant.getTime() + 86400000);
        await tracker.execute(
          actor.userId,
          {
            command: "SubmitReport",
            attemptId: started.resourceId,
            expectedAttemptVersion: version,
            body: "Private report to erase",
            goalValues: [],
          },
          randomUUID()
        );
      }
      assert.ok(
        (await tracker.source(actor.userId, started.resourceId)).completion
      );
      const app = createRepository(required(url), true);
      try {
        const appAuth = createAuth(app.repository, {
          sendMail: async () => {},
        });
        assert.equal((await appAuth.account(owner.token)).id, actor.userId);
        await assert.rejects(app.eraseAccount(actor.userId, randomUUID()), {
          code: "42501",
        });
        await assert.rejects(app.deletionLedger(), { code: "42501" });
        const record = required(
          await app.repository.transaction((tx) =>
            tx.get("users", actor.userId)
          )
        );
        await assert.rejects(
          app.repository.transaction((tx) =>
            tx.save("users", { ...record, admin: true })
          ),
          { code: "42501" }
        );
        await assert.rejects(app.migrate(), { code: "42501" });
      } finally {
        await app.close();
      }
      const event = required(
        (
          await f.db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: started.resourceId })
          )
        )
          .sort((a, b) => b.sourceVersion - a.sourceVersion)
          .at(0)
      );
      await jobs.process({
        eventId: event.id,
        type: event.type,
        schemaVersion: 1,
        aggregateId: event.aggregateId,
        sourceVersion: event.sourceVersion,
        occurredAt: event.occurredAt,
      });
      assert.equal(
        required(await jobs.projection(started.resourceId)).reportingDays,
        101
      );
      const form = await f.db.interactionForm({
        userId: actor.userId,
        kind: "edit",
        resourceId: started.resourceId,
        version: 0,
        enrollmentId: enrollment.resourceId,
        enrollmentVersion: 0,
      });
      const request = await f.auth.execute(
        { action: "request_erasure", confirmed: true },
        owner.token,
        owner.csrf
      );
      assert.ok("requestId" in request);
      const requestId = required(request.requestId);
      await assert.rejects(f.db.eraseAccount(actor.userId, randomUUID()), {
        code: "42501",
      });
      await f.db.eraseAccount(actor.userId, requestId);
      assert.equal(await jobs.projection(started.resourceId), undefined);
      assert.equal(
        await f.db.interactionContext(form, actor.userId),
        undefined
      );
      assert.equal(
        await jobs.process({
          eventId: event.id,
          type: event.type,
          schemaVersion: 1,
          aggregateId: event.aggregateId,
          sourceVersion: event.sourceVersion,
          occurredAt: event.occurredAt,
        }),
        "ignored"
      );
      await assert.rejects(f.auth.authenticate(owner.token), {
        code: "UNAUTHENTICATED",
      });
      assert.equal(
        await f.db.repository.transaction((tx) =>
          tx.get("users", actor.userId)
        ),
        undefined
      );
      assert.equal(
        await f.db.repository.transaction((tx) =>
          tx.get("attempts", started.resourceId)
        ),
        undefined
      );
      assert.ok(
        (await f.db.deletionLedger()).some((row) => row.userId === actor.userId)
      );
      const restoredId = randomUUID();
      await f.db.repository.transaction((tx) =>
        tx.insert("users", {
          id: restoredId,
          participantSeed: "11".repeat(32),
          admin: false,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        })
      );
      await f.db.replayErasures([restoredId]);
      assert.equal(
        await f.db.repository.transaction((tx) => tx.get("users", restoredId)),
        undefined
      );
      await f.db.replayErasures([restoredId]);
      const replacement = await f.signup();
      assert.notEqual(
        (await f.auth.authenticate(replacement.token)).userId,
        actor.userId
      );
    } finally {
      await jobs.close();
      await f.db.close();
    }
  }
);
