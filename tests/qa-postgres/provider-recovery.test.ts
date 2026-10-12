/** @file QA provider-only recovery email proofs and cross-owner session/notification checks. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, url } from "./fixtures.js";
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
