/** @file PostgreSQL OAuth subjects never merge by email and linking requires both proofs. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { fixture, password, required, url } from "./fixtures.js";
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
