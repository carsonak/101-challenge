/** @file PostgreSQL OAuth callbacks serialize subject ownership and proof expiry. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, password, required, url } from "./fixtures.js";
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
          {
            action: "request_erasure",
            confirmed: true,
            username: (await f.auth.account(owner.token)).username,
          },
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
        {
          action: "request_erasure",
          confirmed: true,
          username: (await f.auth.account(owner.token)).username,
        },
        owner.token,
        owner.csrf
      );

      assert.ok("requestId" in request);
    } finally {
      await f.db.close();
    }
  }
);
