import { randomBytes } from "node:crypto";
import {
  authCommandSchema,
  pageRequestSchema,
  trackerErrorCodeSchema,
  type parseServerConfig,
} from "@challenge/contracts";
import {
  DomainError,
  type createAuth,
  type createTracker,
} from "@challenge/core";
import type { createProviders } from "./providers";

/** Shared cookie names; only the session/browser binding are HttpOnly. */
export const cookieNames = {
  session: "challenge_session",
  csrf: "challenge_csrf",
  oauth: "challenge_oauth",
} as const;
/** API dependencies expose only server-owned service handles and settings. */
export interface ApiDependencies {
  /** Validated settings, never serialized wholesale. */
  config: ReturnType<typeof parseServerConfig>;
  /** Session/proof service. */
  auth: ReturnType<typeof createAuth>;
  /** Authorized tracker service. */
  tracker: ReturnType<typeof createTracker>;
  /** Enabled provider transports. */
  providers: ReturnType<typeof createProviders>;
}
/** Read a hex-only cookie without accepting arbitrary encoded header data. */
function cookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
/** Return private uncached JSON with no supplied errors or secret configuration. */
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
/** Read bounded JSON without trusting Content-Length. */
async function payload(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("VALIDATION");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      throw new DomainError("VALIDATION");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("VALIDATION");
  }
}
/** Encode opaque session/CSRF cookies, using TLS for any nonlocal application origin. */
function setCookie(
  response: Response,
  name: string,
  value: string,
  secure: boolean,
  httpOnly: boolean,
  maxAge = 30 * 86400
) {
  response.headers.append(
    "set-cookie",
    `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}${httpOnly ? "; HttpOnly" : ""}`
  );
}
/** Stable opaque resource cursor, scoped to the requested collection. */
function page<T extends { id: string }>(rows: T[], url: URL, kind: string) {
  const parsed = pageRequestSchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  if (!parsed.success) throw new DomainError("VALIDATION");
  let last = "";
  if (parsed.data.cursor) {
    try {
      const cursor = JSON.parse(
        Buffer.from(parsed.data.cursor, "base64url").toString("utf8")
      );
      if (
        cursor.kind !== kind ||
        typeof cursor.id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(cursor.id)
      )
        throw new Error();
      last = cursor.id;
    } catch {
      throw new DomainError("VALIDATION");
    }
  }
  const sorted = rows
    .filter((r) => r.id > last)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const items = sorted.slice(0, parsed.data.limit);
  const final = items.at(-1);
  return {
    items,
    nextCursor:
      sorted.length > items.length && final
        ? Buffer.from(JSON.stringify({ kind, id: final.id })).toString(
            "base64url"
          )
        : null,
  };
}
/** Browser API with actor-derived identity, origin/CSRF checks and safe projections. */
export function createWebApi(deps: ApiDependencies) {
  const { config, auth, tracker, providers } = deps;
  const secure = config.APP_ORIGIN.startsWith("https:");
  const rates = new Map<string, { count: number; expires: number }>();
  /** Bound anonymous/actor mutation rates without storing bodies or addresses. */
  function rate(key: string, limit: number, window = 60000) {
    const now = Date.now();
    const old = rates.get(key);
    const counter =
      old && old.expires > now ? old : { count: 0, expires: now + window };
    counter.count++;
    rates.set(key, counter);
    if (counter.count > limit) throw new DomainError("RATE_LIMITED");
    if (rates.size > 1000)
      for (const [k, v] of rates) if (v.expires <= now) rates.delete(k);
  }
  /** Persist fresh opaque cookies while returning no bearer token in JSON. */
  function loginCookies(
    response: Response,
    session: { token: string; csrf: string }
  ) {
    setCookie(response, cookieNames.session, session.token, secure, true);
    setCookie(response, cookieNames.csrf, session.csrf, secure, false);
  }
  return {
    /** Dispatch native HTTP requests; adapters cannot override actor, date, mode or seeds. */
    async handle(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url),
          path = url.pathname;
        const token = cookie(request, cookieNames.session),
          csrf = request.headers.get("x-csrf-token") ?? undefined;
        if (
          request.method === "POST" &&
          request.headers.get("origin") !== config.APP_ORIGIN
        )
          throw new DomainError("FORBIDDEN");
        if (request.method === "GET" && path === "/api/v1/session") {
          const flags = {
            google: config.googleEnabled,
            discord: config.discordEnabled,
          };
          if (!token)
            return json({ account: null, csrf: null, providers: flags });
          const proof = cookie(request, cookieNames.csrf);
          await auth.authenticate(token, proof);
          return json({
            account: await auth.account(token),
            csrf: proof,
            providers: flags,
          });
        }
        if (request.method === "GET" && path === "/api/v1/seasons")
          return json(page(await tracker.seasons(), url, "seasons"));
        if (
          request.method === "GET" &&
          /^\/api\/v1\/seasons\/[a-f0-9-]{36}$/.test(path)
        ) {
          const season = (await tracker.seasons()).find(
            (s) => s.id === path.split("/").at(-1)
          );
          if (!season) throw new DomainError("NOT_FOUND");
          return json(season);
        }
        if (request.method === "GET" && path === "/api/v1/history") {
          const actor = await auth.authenticate(token);
          return json(
            page(await tracker.history(actor.userId), url, "history")
          );
        }
        if (request.method === "GET" && path === "/api/v1/export") {
          const actor = await auth.authenticate(token);
          const response = json({
            schemaVersion: 1,
            account: await auth.account(token),
            history: await tracker.history(actor.userId),
          });
          response.headers.set(
            "content-disposition",
            'attachment; filename="challenge-history.json"'
          );
          return response;
        }
        if (request.method === "GET" && path === "/api/v1/admin/stats") {
          const actor = await auth.authenticate(token);
          return json(await tracker.adminStats(actor.userId));
        }
        if (request.method === "GET" && path === "/api/v1/admin/seasons") {
          const actor = await auth.authenticate(token);
          return json(
            page(
              await tracker.seasons(actor.userId, true),
              url,
              "admin-seasons"
            )
          );
        }
        if (request.method === "POST" && path === "/api/v1/auth") {
          rate("anonymous-auth", 1000, 10 * 60000);
          const input = await payload(request);
          const c = authCommandSchema.safeParse(input);
          if (!c.success) throw new DomainError("VALIDATION");
          const result = await auth.execute(c.data, token, csrf);
          const response = json({
            accepted: result.accepted,
            ...("requestId" in result ? { requestId: result.requestId } : {}),
          });
          if (
            "token" in result &&
            "csrf" in result &&
            result.token &&
            result.csrf
          )
            loginCookies(response, { token: result.token, csrf: result.csrf });
          if (["logout", "unlink", "reset"].includes(c.data.action)) {
            setCookie(response, cookieNames.session, "", secure, true, 0);
            setCookie(response, cookieNames.csrf, "", secure, false, 0);
          }
          return response;
        }
        if (request.method === "POST" && path === "/api/v1/command") {
          if (!csrf) throw new DomainError("FORBIDDEN");
          const input = await payload(request);
          if (!input || typeof input !== "object")
            throw new DomainError("VALIDATION");
          const cmd = input as { command?: unknown };
          const recent =
            cmd.command === "IssueCorrectionGrant" ||
            cmd.command === "RevokeCorrectionGrant";
          const actor = await auth.authenticate(token, csrf, recent);
          rate(`actor:${actor.userId}`, 120);
          const key = request.headers.get("idempotency-key");
          if (!key || !/^[-\w:]{1,200}$/.test(key))
            throw new DomainError("VALIDATION");
          return json(await tracker.execute(actor.userId, input, key));
        }
        if (request.method === "POST" && path === "/api/v1/oauth") {
          rate("anonymous-oauth", 100, 60000);
          const value = await payload(request);
          if (!value || typeof value !== "object")
            throw new DomainError("VALIDATION");
          const input = value as { provider?: unknown; link?: unknown };
          if (
            (input.provider !== "google" && input.provider !== "discord") ||
            typeof input.link !== "boolean"
          )
            throw new DomainError("VALIDATION");
          const browser = randomBytes(32).toString("hex");
          const state = await auth.beginOAuth(
            input.provider,
            browser,
            token,
            csrf,
            input.link
          );
          const response = json({
            url: providers.authorization(input.provider, state),
          });
          setCookie(response, cookieNames.oauth, browser, secure, true, 600);
          return response;
        }
        if (
          request.method === "GET" &&
          /^\/api\/auth\/(google|discord)\/callback$/.test(path)
        ) {
          const provider = path.includes("/google/") ? "google" : "discord";
          const state = url.searchParams.get("state"),
            code = url.searchParams.get("code"),
            browser = cookie(request, cookieNames.oauth);
          if (!state || !code || !browser || code.length > 4096)
            throw new DomainError("UNAUTHENTICATED");
          const saved = await auth.oauthState(provider, state, browser);
          const proof = await providers.exchange(saved, code);
          const session = await auth.completeOAuth(
            saved.id,
            browser,
            proof,
            token
          );
          const response = new Response(null, {
            status: 303,
            headers: {
              location: `${config.APP_ORIGIN}/account`,
              "cache-control": "no-store",
              "referrer-policy": "no-referrer",
            },
          });
          loginCookies(response, session);
          setCookie(response, cookieNames.oauth, "", secure, true, 0);
          return response;
        }
        return json({ code: "NOT_FOUND" }, 404);
      } catch (error) {
        const code = trackerErrorCodeSchema.safeParse(
          (error as { code?: unknown })?.code
        );
        if (!code.success) return json({ error: "Service unavailable" }, 503);
        const statuses: Record<string, number> = {
          UNAUTHENTICATED: 401,
          FORBIDDEN: 403,
          NOT_FOUND: 404,
          VALIDATION: 400,
          RATE_LIMITED: 429,
        };
        return json({ code: code.data }, statuses[code.data] ?? 409);
      }
    },
  };
}
