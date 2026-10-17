/** @file OAuth initiation keeps the canonical browser origin and provider callbacks aligned without contacting providers. */
import assert from "node:assert/strict";
import test from "node:test";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createWebApi, type ApiDependencies } from "../apps/web/server/api.js";
import { createProviders } from "../apps/web/server/providers.js";

test("OAuth initiation rejects alternative origins before creating state and binds both enabled providers", async () => {
  const origin = "http://localhost:4173";
  const config = parseServerConfig({
    APP_ORIGIN: origin,
    GOOGLE_CLIENT_ID: "fictional-google",
    GOOGLE_CLIENT_SECRET: "fictional-secret",
    GOOGLE_REDIRECT_URI: `${origin}/api/auth/google/callback`,
    DISCORD_CLIENT_ID: "fictional-discord",
    DISCORD_CLIENT_SECRET: "fictional-secret",
    DISCORD_REDIRECT_URI: `${origin}/api/auth/discord/callback`,
  });

  let calls = 0;
  let binding = "";
  const api = createWebApi({
    config,
    auth: {
      async beginOAuth(
        provider: string,
        browser: string,
        token: unknown,
        csrf: unknown,
        link: boolean
      ) {
        calls++;
        assert.match(browser, /^[a-f0-9]{64}$/);
        assert.equal(token, undefined);
        assert.equal(csrf, undefined);
        assert.equal(link, false);
        assert.ok(provider === "google" || provider === "discord");
        binding = browser;
        return {
          state: "fictional-state",
          nonce: "fictional-nonce",
          verifier: "fictional-verifier",
        };
      },
    } as unknown as ApiDependencies["auth"],
    tracker: {} as ApiDependencies["tracker"],
    providers: createProviders(config),
  });

  for (const provider of ["google", "discord"] as const) {
    for (const other of [
      undefined,
      "http://127.0.0.1:4173",
      "http://localhost:3000",
      "https://foreign.invalid",
    ]) {
      const response = await api.handle(
        new Request(`${origin}/api/v1/oauth`, {
          method: "POST",
          headers: other ? { origin: other } : {},
          body: JSON.stringify({ provider, link: false }),
        })
      );

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { code: "FORBIDDEN" });
      assert.equal(response.headers.get("set-cookie"), null);
    }

    const before = calls;
    const response = await api.handle(
      new Request(`${origin}/api/v1/oauth`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ provider, link: false }),
      })
    );

    assert.equal(response.status, 200);
    assert.equal(calls, before + 1);
    const authorization = new URL((await response.json()).url);
    assert.equal(
      authorization.origin,
      provider === "google"
        ? "https://accounts.google.com"
        : "https://discord.com"
    );

    assert.equal(
      authorization.searchParams.get("redirect_uri"),
      `${origin}/api/auth/${provider}/callback`
    );

    assert.equal(
      authorization.searchParams.get("scope"),
      provider === "google" ? "openid profile email" : "identify"
    );

    assert.equal(authorization.searchParams.get("state"), "fictional-state");
    assert.equal(authorization.searchParams.get("response_type"), "code");
    if (provider === "google") {
      assert.equal(authorization.searchParams.get("nonce"), "fictional-nonce");
      assert.equal(
        authorization.searchParams.get("code_challenge_method"),
        "S256"
      );

      assert.match(
        authorization.searchParams.get("code_challenge") ?? "",
        /^[A-Za-z0-9_-]{43}$/
      );
    }

    assert.ok(
      response.headers.get("set-cookie")?.includes(`challenge_oauth=${binding}`)
    );

    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);
  }

  assert.equal(calls, 2);
});
