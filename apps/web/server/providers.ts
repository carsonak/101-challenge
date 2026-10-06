import { createHash } from "node:crypto";
import {
  createRemoteJWKSet,
  jwtVerify,
  customFetch,
  type JWTVerifyGetKey,
} from "jose";
import {
  DomainError,
  type OAuthState,
  type ProviderProof,
} from "@challenge/core";
import type { parseServerConfig } from "@challenge/contracts";

/** Validated server configuration; all credentials remain inside this adapter. */
type Config = ReturnType<typeof parseServerConfig>;
/** Provider transports with injectable HTTP/JWKS for deterministic local tests. */
export function createProviders(
  config: Config,
  http: typeof fetch = fetch,
  googleKey?: JWTVerifyGetKey
) {
  const jwks =
    googleKey ??
    createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
      [customFetch]: http,
      timeoutDuration: 5000,
    });
  /** Resolve only a fully enabled provider and its exact allowlisted callback. */
  function settings(provider: "google" | "discord") {
    const enabled =
      provider === "google" ? config.googleEnabled : config.discordEnabled;
    const clientId =
      provider === "google"
        ? config.GOOGLE_CLIENT_ID
        : config.DISCORD_CLIENT_ID;
    const clientSecret =
      provider === "google"
        ? config.GOOGLE_CLIENT_SECRET
        : config.DISCORD_CLIENT_SECRET;
    const redirect =
      provider === "google"
        ? config.GOOGLE_REDIRECT_URI
        : config.DISCORD_REDIRECT_URI;
    if (!enabled || !clientId || !clientSecret || !redirect)
      throw new DomainError("VALIDATION");
    return { clientId, clientSecret, redirect };
  }
  return {
    /** Build authorization with browser-bound state; Google also uses PKCE and OIDC nonce. */
    authorization(
      provider: "google" | "discord",
      state: { state: string; nonce: string; verifier: string }
    ) {
      const s = settings(provider);
      const url = new URL(
        provider === "google"
          ? "https://accounts.google.com/o/oauth2/v2/auth"
          : "https://discord.com/oauth2/authorize"
      );
      url.search = new URLSearchParams({
        client_id: s.clientId,
        redirect_uri: s.redirect,
        response_type: "code",
        scope: provider === "google" ? "openid" : "identify",
        state: state.state,
      }).toString();
      if (provider === "google") {
        url.searchParams.set("nonce", state.nonce);
        url.searchParams.set(
          "code_challenge",
          createHash("sha256").update(state.verifier).digest("base64url")
        );
        url.searchParams.set("code_challenge_method", "S256");
      }
      return url.toString();
    },
    /** Exchange a code and validate stable subject proof; ignore all provider email claims. */
    async exchange(state: OAuthState, code: string): Promise<ProviderProof> {
      const s = settings(state.provider);
      try {
        const fields = new URLSearchParams({
          client_id: s.clientId,
          client_secret: s.clientSecret,
          redirect_uri: s.redirect,
          grant_type: "authorization_code",
          code,
        });
        if (state.provider === "google")
          fields.set("code_verifier", state.verifier);
        const response = await http(
          state.provider === "google"
            ? "https://oauth2.googleapis.com/token"
            : "https://discord.com/api/oauth2/token",
          {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: fields,
            signal: AbortSignal.timeout(5000),
          }
        );
        if (!response.ok) throw new Error("Provider unavailable");
        const tokens = (await response.json()) as {
          id_token?: unknown;
          access_token?: unknown;
          token_type?: unknown;
        };
        if (state.provider === "google") {
          if (typeof tokens.id_token !== "string")
            throw new Error("Invalid proof");
          const { payload } = await jwtVerify(tokens.id_token, jwks, {
            issuer: ["https://accounts.google.com", "accounts.google.com"],
            audience: s.clientId,
            algorithms: ["RS256"],
            maxTokenAge: "1h",
            clockTolerance: 30,
            requiredClaims: ["exp", "iat", "sub", "nonce", "aud", "iss"],
          });
          if (
            payload.nonce !== state.nonce ||
            typeof payload.sub !== "string" ||
            !payload.sub
          )
            throw new Error("Invalid proof");
          return { provider: "google", subject: payload.sub };
        }
        if (
          typeof tokens.access_token !== "string" ||
          tokens.token_type !== "Bearer"
        )
          throw new Error("Invalid proof");
        const profile = await http("https://discord.com/api/v10/users/@me", {
          headers: { authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (!profile.ok) throw new Error("Invalid proof");
        const identity = (await profile.json()) as { id?: unknown };
        if (typeof identity.id !== "string" || !/^\d{1,30}$/.test(identity.id))
          throw new Error("Invalid proof");
        return { provider: "discord", subject: identity.id };
      } catch {
        throw new DomainError("UNAUTHENTICATED");
      }
    },
  };
}
