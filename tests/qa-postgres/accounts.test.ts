/** @file QA usernames, recovery-only sessions, deletion email retries and atomic restoration. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import test from "node:test";
import { fixture, password, url } from "./fixtures.js";
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
