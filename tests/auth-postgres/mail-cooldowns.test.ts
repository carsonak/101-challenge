/** @file verification and recovery cooldowns normalize addresses, remain enumeration-safe and expire at the boundary. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { email, fixture, password, url } from "./fixtures.js";
test(
  "verification and recovery cooldowns normalize addresses, remain enumeration-safe and expire at the boundary",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email();
      const input = {
        action: "signup",
        username: randomUUID().slice(0, 32),
        email: address,
        password,
      };

      assert.deepEqual(await f.auth.execute(input), { accepted: true });
      assert.equal(f.mail.length, 1);
      assert.deepEqual(
        await f.auth.execute({ ...input, email: address.toUpperCase() }),
        { accepted: true }
      );

      assert.equal(f.mail.length, 1);
      assert.ok(f.mail[0]);
      await f.auth.execute({ action: "verify", token: f.mail[0].token });
      assert.deepEqual(
        await f.auth.execute({ action: "recover", email: address }),
        { accepted: true }
      );

      assert.equal(f.mail.length, 2);
      assert.deepEqual(
        await f.auth.execute({
          action: "recover",
          email: address.toUpperCase(),
        }),
        { accepted: true }
      );

      assert.equal(f.mail.length, 2);
      const unknown = email();
      assert.deepEqual(
        await f.auth.execute({ action: "recover", email: unknown }),
        { accepted: true }
      );

      assert.equal(f.mail.length, 2);
      f.advance(15);
      await f.auth.execute({ action: "recover", email: address });
      assert.equal(f.mail.length, 3);
    } finally {
      await f.db.close();
    }
  }
);
