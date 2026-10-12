/** @file QA concurrent username claims and exact deletion deadline reject recovery safely. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, password, url } from "./fixtures.js";
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
