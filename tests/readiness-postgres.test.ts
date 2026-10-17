/** @file Pre-QA credential lifetime and bounded administration regressions on disposable PostgreSQL. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { createAuth, createTracker } from "../packages/core/src/index.js";
import {
  fixture,
  email,
  password,
  required,
  url,
} from "./auth-postgres/fixtures.js";

test(
  "verification resend never creates accounts and shares signup cooldown without password work",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email();
      await f.auth.execute({ action: "resend_verification", email: address });
      assert.equal(f.mail.length, 0);
      const before = await f.db.repository.transaction((tx) =>
        tx.list("credentials", { email: address })
      );

      assert.equal(before.length, 0);
      await f.auth.execute({
        action: "signup",
        username: randomUUID().slice(0, 32),
        email: address,
        password,
      });

      // Unknown-address requests consume the same cooldown to avoid enumeration.
      assert.equal(f.mail.length, 0);
      f.advance(15);
      await f.auth.execute({
        action: "resend_verification",
        email: ` ${address.toUpperCase()} `,
      });

      assert.equal(f.mail.length, 1);
      await f.auth.execute({ action: "resend_verification", email: address });
      assert.equal(f.mail.length, 1);
      await f.auth.execute({
        action: "verify",
        token: required(f.mail.at(-1)).token,
      });

      f.advance(15);
      await f.auth.execute({ action: "resend_verification", email: address });
      assert.equal(f.mail.length, 1);
    } finally {
      await f.db.close();
    }
  }
);

test(
  "replicas share verification cooldown and return identical accepted responses",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email();
      await f.auth.execute({
        action: "signup",
        username: randomUUID().slice(0, 32),
        email: address,
        password,
      });

      const send = async (mail: (typeof f.mail)[number]) => {
        f.mail.push(mail);
      };

      const a = createAuth(f.db.repository, {
        sendMail: send,
        cooldown: f.db.rates,
      });

      const b = createAuth(f.db.repository, {
        sendMail: send,
        cooldown: f.db.rates,
      });

      const responses = await Promise.all(
        [a, b].map((auth) =>
          auth.execute({ action: "resend_verification", email: address })
        )
      );

      assert.deepEqual(responses, [{ accepted: true }, { accepted: true }]);
      assert.equal(f.mail.length, 2);
    } finally {
      await f.db.close();
    }
  }
);

test(
  "password changes require recent CSRF proof and revoke sessions and outstanding reset links",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owner = await f.signup();
      await f.auth.execute({ action: "recover", email: owner.address });
      const oldReset = required(f.mail.at(-1)).token;
      f.advance(11);
      await assert.rejects(
        f.auth.execute(
          { action: "change_password", password: `${password} new` },
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

      await assert.rejects(
        f.auth.execute(
          { action: "change_password", password: `${password} new` },
          owner.token,
          "wrong"
        ),
        { code: "FORBIDDEN" }
      );

      await f.auth.execute(
        { action: "change_password", password: `${password} new` },
        owner.token,
        owner.csrf
      );

      await assert.rejects(f.auth.account(owner.token), {
        code: "UNAUTHENTICATED",
      });

      await assert.rejects(
        f.auth.execute({ action: "reset", token: oldReset, password }),
        { code: "UNAUTHENTICATED" }
      );

      await assert.rejects(
        f.auth.execute({ action: "login", email: owner.address, password }),
        { code: "UNAUTHENTICATED" }
      );

      assert.ok(
        "token" in
          (await f.auth.execute({
            action: "login",
            email: owner.address,
            password: `${password} new`,
          }))
      );
    } finally {
      await f.db.close();
    }
  }
);

test(
  "proofs for an unlinked credential cannot verify or reset a replacement address",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email(),
        username = randomUUID().slice(0, 32);

      await f.auth.execute({
        action: "signup",
        email: address,
        username,
        password,
      });

      const oldVerify = required(f.mail.at(-1)).token;
      f.advance(15);
      await f.auth.execute({ action: "resend_verification", email: address });
      await f.auth.execute({
        action: "verify",
        token: required(f.mail.at(-1)).token,
      });

      const session = await f.auth.execute({
        action: "login",
        email: address,
        password,
      });

      assert.ok("token" in session && "csrf" in session);
      const owner = {
        address,
        token: required(session.token),
        csrf: required(session.csrf),
      };

      await f.auth.execute({ action: "recover", email: owner.address });
      const oldReset = required(f.mail.at(-1)).token;
      const browser = randomBytes(32).toString("hex"),
        subject = randomUUID();

      const link = await f.auth.beginOAuth(
        "discord",
        browser,
        owner.token,
        owner.csrf,
        true
      );

      const state = await f.auth.oauthState("discord", link.state, browser);
      const linked = await f.auth.completeOAuth(
        state.id,
        browser,
        { provider: "discord", subject },
        owner.token
      );

      await f.auth.execute(
        { action: "unlink", provider: "email" },
        linked.token,
        linked.csrf
      );

      const next = await f.auth.beginOAuth("discord", browser);
      const nextState = await f.auth.oauthState("discord", next.state, browser);
      const login = await f.auth.completeOAuth(nextState.id, browser, {
        provider: "discord",
        subject,
      });

      await f.auth.execute(
        { action: "add_email", email: email(), password },
        login.token,
        login.csrf
      );

      for (const [action, token] of [
        ["verify", oldVerify],
        ["reset", oldReset],
      ])
        await assert.rejects(
          f.auth.execute({
            action,
            token,
            ...(action === "reset" ? { password } : {}),
          }),
          { code: "UNAUTHENTICATED" }
        );

      assert.equal((await f.auth.account(login.token)).emailVerified, false);
    } finally {
      await f.db.close();
    }
  }
);

test(
  "administrator lookup is paged and scoped metadata excludes private text and seeds",
  { skip: !url },
  async () => {
    const f = await fixture();
    const tracker = createTracker(f.db.repository, { now: f.now });
    try {
      const admin = await tracker.createUser(true),
        user = await tracker.createUser();

      const prefix = `readiness-${randomUUID().slice(0, 8)}`;
      for (const [id, suffix] of [
        [admin, "a"],
        [user, "b"],
      ])
        await f.db.repository.transaction(async (tx) => {
          const profile = required(
            await tx.get("profiles", required(id), true)
          );

          profile.username = `${prefix}-${suffix}`;
          await tx.save("profiles", profile);
        });

      await assert.rejects(tracker.adminParticipants(user), {
        code: "FORBIDDEN",
      });

      const first = await tracker.adminParticipants(
        admin,
        prefix,
        undefined,
        1
      );

      assert.equal(first.items.length, 1);
      assert.ok(first.nextCursor);
      const second = await tracker.adminParticipants(
        admin,
        prefix,
        first.nextCursor,
        1
      );

      assert.equal(second.items.length, 1);
      assert.notEqual(first.items[0]?.id, second.items[0]?.id);
      assert.equal(second.nextCursor, null);
      const stats = await tracker.adminStats(admin, { participantId: user });
      assert.deepEqual(
        stats.users.map((p) => p.id),
        [user]
      );

      assert.deepEqual(stats.attempts, []);
      assert.doesNotMatch(
        JSON.stringify(stats),
        /password|body|Seed|tokenHash|recoveryEmail/
      );

      await assert.rejects(
        tracker.execute(
          admin,
          {
            command: "IssueCorrectionGrant",
            kind: "single_report",
            reportId: randomUUID(),
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
  "operator suspension blocks old sessions, new login and tracker commands without changing history",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owner = await f.signup();
      const account = await f.auth.account(owner.token);
      const tracker = createTracker(f.db.repository);
      const before = await tracker.history(account.id);
      await f.db.repository.transaction((tx) =>
        tx.insert("account_suspensions", {
          id: account.id,
          suspendedAt: f.now().toISOString(),
        })
      );

      await assert.rejects(f.auth.account(owner.token), {
        code: "UNAUTHENTICATED",
      });

      await assert.rejects(
        f.auth.execute({ action: "login", email: owner.address, password }),
        { code: "UNAUTHENTICATED" }
      );

      await assert.rejects(tracker.history(account.id), { code: "FORBIDDEN" });
      const { createRequire } = await import("node:module");
      const { Pool } = createRequire(
        new URL("../packages/db/package.json", import.meta.url)
      )("pg");

      const pool = new Pool({ connectionString: url });
      try {
        await pool.query("DELETE FROM account_suspensions WHERE id=$1", [
          account.id,
        ]);
      } finally {
        await pool.end();
      }

      assert.deepEqual(await tracker.history(account.id), before);
    } finally {
      await f.db.close();
    }
  }
);
