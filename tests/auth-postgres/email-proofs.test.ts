/** @file PostgreSQL email verification, CSRF, logout and recovery are one-use. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { email, fixture, password, required, url } from "./fixtures.js";
test(
  "PostgreSQL email verification, CSRF, logout and recovery are one-use",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const address = email();
      assert.deepEqual(
        await f.auth.execute({
          action: "signup",
          username: randomUUID().slice(0, 32),
          email: address,
          password,
        }),
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
