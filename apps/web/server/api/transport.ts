import {
  pageRequestSchema,
  type parseServerConfig,
} from "@challenge/contracts";
import {
  DomainError,
  type createAuth,
  type createTracker,
} from "@challenge/core";
import type { createProviders } from "../providers";
/** Shared cookie names; only the session/browser binding are HttpOnly. */
export const cookieNames = {
  session: "challenge_session",
  csrf: "challenge_csrf",
  oauth: "challenge_oauth",
} as const;

/** API dependencies expose only server-owned service handles and settings. */
export interface ApiDependencies {
  /** Injectable limiter clock. */
  now?: () => number;
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
export function cookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** Return private uncached JSON with no supplied errors or secret configuration. */
export function json(value: unknown, status = 200) {
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
export async function payload(request: Request): Promise<unknown> {
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
export function setCookie(
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
export function page<T extends { id: string }>(
  rows: T[],
  url: URL,
  kind: string
) {
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
