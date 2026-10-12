/** @file Browser bootstrap recovers stale cookies without masking service failures. */
import assert from "node:assert/strict";
import test from "node:test";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { DomainError } from "../packages/core/src/index.js";
import { createWebApi, type ApiDependencies } from "../apps/web/server/api.js";
import { createProviders } from "../apps/web/server/providers.js";

test("session bootstrap clears stale cookies, preserves deletion access and exposes genuine outages", async () => {
  const config = parseServerConfig({
    APP_ORIGIN: "https://challenge.example",
    GOOGLE_CLIENT_ID: "fictional-google",
    GOOGLE_CLIENT_SECRET: "fictional-secret",
    GOOGLE_REDIRECT_URI: "https://challenge.example/api/auth/google/callback",
    DISCORD_CLIENT_ID: "fictional-discord",
    DISCORD_CLIENT_SECRET: "fictional-secret",
    DISCORD_REDIRECT_URI: "https://challenge.example/api/auth/discord/callback",
  });

  let failure: Error | undefined = new DomainError("UNAUTHENTICATED");
  const account = {
    id: "fictional-owner",
    deletion: { deleteAfter: "fictional-date" },
  };

  const api = createWebApi({
    config,
    auth: {
      account: async () => {
        if (failure) throw failure;

        return account;
      },
    } as unknown as ApiDependencies["auth"],
    tracker: {} as ApiDependencies["tracker"],
    providers: createProviders(config),
  });

  const request = () =>
    api.handle(
      new Request(`${config.APP_ORIGIN}/api/v1/session`, {
        headers: {
          cookie: `challenge_session=${"a".repeat(64)}; challenge_csrf=${"b".repeat(64)}`,
        },
      })
    );

  const stale = await request();
  assert.equal(stale.status, 200);
  assert.deepEqual(await stale.json(), {
    account: null,
    csrf: null,
    providers: { google: true, discord: true },
  });

  const cleared = stale.headers.getSetCookie();
  assert.equal(cleared.length, 2);
  for (const header of cleared)
    assert.match(header, /Path=\/; SameSite=Lax; Max-Age=0; Secure/);

  assert.match(cleared[0], /challenge_session=;.*HttpOnly/);
  assert.match(cleared[1], /^challenge_csrf=;/);
  failure = undefined;
  const valid = await request();
  assert.equal(valid.status, 200);
  assert.deepEqual((await valid.json()).account, account);
  assert.equal(valid.headers.getSetCookie().length, 0);
  failure = new Error("fictional unavailable database");
  const unavailable = await request();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.getSetCookie().length, 0);
  assert.deepEqual(await unavailable.json(), { error: "Service unavailable" });
});
