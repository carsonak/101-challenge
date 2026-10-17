/** @file Username-first accounts, provider defaults and verified recovery aliases use disposable PostgreSQL only. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { usernameSchema } from "../packages/contracts/src/index.js";
import {
  fixture,
  email,
  password,
  required,
  url,
} from "./auth-postgres/fixtures.js";

test("usernames are URL-safe, case insensitive, space-free and at most 40 characters", () => {
  assert.equal(usernameSchema.parse("A".repeat(40)), "a".repeat(40));
  for (const value of [
    "a".repeat(41),
    "has space",
    " padded",
    "padded ",
    "a/b",
    "a.b",
    "üser",
    "a%20b",
    "ab",
  ])
    assert.equal(usernameSchema.safeParse(value).success, false, value);
});

test(
  "username/password works without email; verified alias replacement invalidates old recovery proofs",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const username = `owner-${randomUUID()}`.slice(0, 40);
      await f.auth.execute({ action: "signup", username, password });
      assert.equal(f.mail.length, 0);
      const login = await f.auth.execute({
        action: "login",
        username: username.toUpperCase(),
        password,
      });

      const token = required(login.token),
        csrf = required(login.csrf);

      assert.equal((await f.auth.account(token)).hasPassword, true);
      const first = email();
      await f.auth.execute(
        { action: "recovery_email", email: first },
        token,
        csrf
      );

      await assert.rejects(
        f.auth.execute({ action: "login", identifier: first, password }),
        { code: "UNAUTHENTICATED" }
      );

      await f.auth.execute({
        action: "verify_recovery_email",
        token: required(f.mail.at(-1)).token,
      });

      await f.auth.execute({
        action: "login",
        identifier: first.toUpperCase(),
        password,
      });

      await f.auth.execute({ action: "recover", email: first });
      const stale = required(f.mail.at(-1)).token;
      const second = email();
      await f.auth.execute(
        { action: "recovery_email", email: second },
        token,
        csrf
      );

      await f.auth.execute({ action: "login", email: first, password });
      await f.auth.execute({
        action: "verify_recovery_email",
        token: required(f.mail.at(-1)).token,
      });

      await assert.rejects(
        f.auth.execute({ action: "login", email: first, password }),
        { code: "UNAUTHENTICATED" }
      );

      await assert.rejects(
        f.auth.execute({
          action: "reset",
          token: stale,
          password: `${password} changed`,
        }),
        { code: "UNAUTHENTICATED" }
      );

      await f.auth.execute({ action: "login", identifier: second, password });
      const renamed = `new-${randomUUID()}`;
      await f.auth.execute(
        { action: "save_profile", username: renamed },
        token,
        csrf
      );

      await assert.rejects(
        f.auth.execute({ action: "login", username, password }),
        { code: "UNAUTHENTICATED" }
      );

      await f.auth.execute({ action: "login", username: renamed, password });
      f.advance(15);
      const other = await f.signup();
      await assert.rejects(
        f.auth.execute(
          { action: "recovery_email", email: second },
          other.token,
          other.csrf
        ),
        { code: "VALIDATION" }
      );

      const fresh = await f.auth.execute({
        action: "login",
        username: renamed,
        password,
      });

      await f.auth.execute(
        { action: "recovery_email", email: email() },
        required(fresh.token),
        required(fresh.csrf)
      );

      const pending = required(f.mail.at(-1)).token;
      await f.auth.execute(
        { action: "change_password", password: `${password} changed` },
        required(fresh.token),
        required(fresh.csrf)
      );

      await assert.rejects(
        f.auth.execute({ action: "verify_recovery_email", token: pending }),
        { code: "UNAUTHENTICATED" }
      );
    } finally {
      await f.db.close();
    }
  }
);

test(
  "optional signup email never gates username login or enables unverified email recovery",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const username = randomUUID(),
        address = email();

      await f.auth.execute({
        action: "signup",
        username,
        email: address,
        password,
      });

      const proof = required(f.mail.at(-1));
      await f.auth.execute({ action: "login", username, password });
      await assert.rejects(
        f.auth.execute({ action: "login", email: address, password }),
        { code: "UNAUTHENTICATED" }
      );

      await f.auth.execute({ action: "recover", email: address });
      assert.equal(f.mail.length, 1);
      await f.auth.execute({ action: "verify", token: proof.token });
      await f.auth.execute({ action: "login", identifier: address, password });
    } finally {
      await f.db.close();
    }
  }
);

test(
  "Google requires username setup and supplies recovery; Discord supplies username; either can add password",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const browser = randomBytes(32).toString("hex");
      for (const provider of ["google", "discord"] as const) {
        const begin = await f.auth.beginOAuth(provider, browser),
          state = await f.auth.oauthState(provider, begin.state, browser),
          address = email();

        const session = await f.auth.completeOAuth(state.id, browser, {
          provider,
          subject: randomUUID(),
          ...(provider === "google"
            ? { recoveryEmail: address }
            : { username: `discord-${randomUUID()}` }),
        });

        let account = await f.auth.account(session.token);
        assert.equal(account.hasPassword, false);
        assert.equal(account.provisional, provider === "google");
        assert.equal(
          account.recoveryEmail,
          provider === "google" ? address : null
        );

        if (account.provisional) {
          await f.auth.execute(
            { action: "save_profile", username: randomUUID() },
            session.token,
            session.csrf
          );

          account = await f.auth.account(session.token);
        }

        await f.auth.execute(
          { action: "change_password", password },
          session.token,
          session.csrf
        );

        await assert.rejects(f.auth.account(session.token), {
          code: "UNAUTHENTICATED",
        });

        await f.auth.execute({
          action: "login",
          username: account.username,
          password,
        });

        if (provider === "google")
          await f.auth.execute({
            action: "login",
            identifier: address,
            password,
          });
      }
    } finally {
      await f.db.close();
    }
  }
);

test(
  "Google email collision never merges or initializes another owner's recovery",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owner = await f.signup(),
        original = await f.auth.account(owner.token),
        browser = randomBytes(32).toString("hex");

      const begin = await f.auth.beginOAuth("google", browser),
        state = await f.auth.oauthState("google", begin.state, browser);

      const session = await f.auth.completeOAuth(state.id, browser, {
        provider: "google",
        subject: randomUUID(),
        recoveryEmail: owner.address,
      });

      const account = await f.auth.account(session.token);
      assert.notEqual(account.id, original.id);
      assert.equal(account.recoveryEmail, null);
    } finally {
      await f.db.close();
    }
  }
);

test(
  "concurrent recovery aliases have one owner and legacy ambiguity fails closed",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const owners = await Promise.all([f.signup(), f.signup()]),
        address = email();

      const proofs: string[] = [];
      for (const [index, owner] of owners.entries()) {
        if (index) f.advance(15);

        const login = await f.auth.execute({
          action: "login",
          email: owner.address,
          password,
        });

        owner.token = required(login.token);
        owner.csrf = required(login.csrf);
        await f.auth.execute(
          { action: "recovery_email", email: address },
          owner.token,
          owner.csrf
        );

        proofs.push(required(f.mail.at(-1)).token);
      }

      const result = await Promise.allSettled(
        proofs.map((token) =>
          f.auth.execute({ action: "verify_recovery_email", token })
        )
      );

      assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
      const duplicate = email();
      for (const owner of owners)
        await f.db.repository.transaction(async (tx) => {
          const account = await f.auth.account(owner.token),
            p = required(await tx.get("profiles", account.id));

          p.recoveryEmail = duplicate;
          await tx.save("profiles", p);
        });

      await assert.rejects(
        f.auth.execute({ action: "login", email: duplicate, password }),
        { code: "UNAUTHENTICATED" }
      );

      const count = f.mail.length;
      await f.auth.execute({ action: "recover", email: duplicate });
      assert.equal(f.mail.length, count);
    } finally {
      await f.db.close();
    }
  }
);

test(
  "verified provider recovery can set a first password without merging identities",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const browser = randomBytes(32).toString("hex"),
        address = email(),
        begin = await f.auth.beginOAuth("google", browser),
        state = await f.auth.oauthState("google", begin.state, browser);

      const login = await f.auth.completeOAuth(state.id, browser, {
        provider: "google",
        subject: randomUUID(),
        recoveryEmail: address,
      });

      const account = await f.auth.account(login.token);
      await f.auth.execute(
        { action: "save_profile", username: randomUUID() },
        login.token,
        login.csrf
      );

      await f.auth.execute({ action: "recover", email: address });
      await f.auth.execute({
        action: "reset",
        token: required(f.mail.at(-1)).token,
        password,
      });

      const result = await f.auth.execute({
        action: "login",
        email: address,
        password,
      });

      assert.equal(
        (await f.auth.account(required(result.token))).id,
        account.id
      );

      await assert.rejects(f.auth.account(login.token), {
        code: "UNAUTHENTICATED",
      });
    } finally {
      await f.db.close();
    }
  }
);

test(
  "recovery cannot mark a different pending credential email as verified",
  { skip: !url },
  async () => {
    const f = await fixture();
    try {
      const browser = randomBytes(32).toString("hex"),
        address = email(),
        pending = email();

      const begin = await f.auth.beginOAuth("google", browser),
        state = await f.auth.oauthState("google", begin.state, browser);

      const session = await f.auth.completeOAuth(state.id, browser, {
        provider: "google",
        subject: randomUUID(),
        recoveryEmail: address,
      });

      await f.auth.execute(
        { action: "add_email", email: pending, password },
        session.token,
        session.csrf
      );

      const stale = required(f.mail.at(-1)).token;
      await f.auth.execute({ action: "recover", email: address });
      await f.auth.execute({
        action: "reset",
        token: required(f.mail.at(-1)).token,
        password,
      });

      const login = await f.auth.execute({
        action: "login",
        email: address,
        password,
      });

      const account = await f.auth.account(required(login.token));
      assert.equal(account.email, address);
      await assert.rejects(
        f.auth.execute({ action: "login", email: pending, password }),
        { code: "UNAUTHENTICATED" }
      );

      await assert.rejects(f.auth.execute({ action: "verify", token: stale }), {
        code: "UNAUTHENTICATED",
      });
    } finally {
      await f.db.close();
    }
  }
);
