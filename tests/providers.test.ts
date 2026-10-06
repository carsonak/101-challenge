/** @file Provider transport doubles verify real signatures without contacting providers. */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import type { OAuthState } from "../packages/core/src/index.js";
import { createProviders } from "../apps/web/server/providers.js";
test("Google validates issuer, audience, nonce, expiry and signature; Discord uses stable subject only", async () => {
  const config = parseServerConfig({
    GOOGLE_CLIENT_ID: "fictional-google",
    GOOGLE_CLIENT_SECRET: "fictional-secret",
    GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
    DISCORD_CLIENT_ID: "fictional-discord",
    DISCORD_CLIENT_SECRET: "fictional-secret",
    DISCORD_REDIRECT_URI: "http://localhost:3000/api/auth/discord/callback",
  });
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = {
    ...keys.publicKey.export({ format: "jwk" }),
    kid: "fixture",
    alg: "RS256",
    use: "sig",
  };
  let claims: Record<string, unknown> = {},
    badSignature = false;
  const calls: string[] = [];
  const http: typeof fetch = async (input, init) => {
    const address = String(input);
    calls.push(address);
    if (address.includes("/certs")) return Response.json({ keys: [jwk] });
    if (address.includes("googleapis.com/token")) {
      const fields = init?.body as URLSearchParams;
      assert.equal(fields.get("code_verifier"), "fictional-verifier");
      const now = Math.floor(Date.now() / 1000),
        header = Buffer.from(
          JSON.stringify({ alg: "RS256", kid: "fixture" })
        ).toString("base64url"),
        payload = Buffer.from(
          JSON.stringify({
            iss: "https://accounts.google.com",
            aud: "fictional-google",
            sub: "stable-google-subject",
            nonce: "fictional-nonce",
            iat: now,
            exp: now + 60,
            email: "ignored@example.invalid",
            ...claims,
          })
        ).toString("base64url"),
        signature = sign(
          "RSA-SHA256",
          Buffer.from(`${header}.${payload}`),
          keys.privateKey
        ).toString("base64url");
      return Response.json({
        id_token: `${header}.${payload}.${badSignature ? "A".repeat(signature.length) : signature}`,
      });
    }
    if (address.endsWith("/oauth2/token"))
      return Response.json({
        access_token: "fictional-transient-access",
        token_type: "Bearer",
      });
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer fictional-transient-access"
    );
    return Response.json({ id: "123456789", email: "ignored@example.invalid" });
  };
  const providers = createProviders(config, http);
  const state: OAuthState = {
    id: "00000000-0000-4000-8000-000000000000",
    provider: "google",
    userId: null,
    stateHash: "fictional",
    browserHash: "fictional",
    nonce: "fictional-nonce",
    verifier: "fictional-verifier",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    usedAt: null,
  };
  const authURL = new URL(
    providers.authorization("google", {
      state: "state",
      nonce: state.nonce,
      verifier: state.verifier,
    })
  );
  assert.equal(authURL.searchParams.get("code_challenge_method"), "S256");
  assert.deepEqual(await providers.exchange(state, "code"), {
    provider: "google",
    subject: "stable-google-subject",
  });
  for (const invalid of [
    { iss: "https://evil.invalid" },
    { aud: "wrong" },
    { nonce: "wrong" },
    { exp: 1 },
  ]) {
    claims = invalid;
    await assert.rejects(providers.exchange(state, "code"), {
      code: "UNAUTHENTICATED",
    });
  }
  claims = {};
  badSignature = true;
  await assert.rejects(providers.exchange(state, "code"), {
    code: "UNAUTHENTICATED",
  });
  assert.deepEqual(
    await providers.exchange({ ...state, provider: "discord" }, "code"),
    { provider: "discord", subject: "123456789" }
  );
  assert.ok(calls.every((c) => !c.includes("email")));
});
