import { trackerErrorCodeSchema } from "@challenge/contracts";

/** Known transport/database codes identify failures without error messages or SQL. */
export const safeCodes = new Set([
  "MIGRATIONS_REQUIRED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EADDRINUSE",
  "EACCES",
  "EPERM",
  "EAUTH",
  "ESOCKET",
  "ECONNECTION",
  "23505",
  "23503",
  "23514",
  "40001",
  "40P01",
  "42501",
  "42P01",
  "42703",
  "28P01",
  "3D000",
  "53300",
  "57P01",
  "57014",
]);

/** Operator actions for recognized infrastructure failures; never derived from error text. */
export const errorHints: Record<string, string> = {
  MIGRATIONS_REQUIRED: "Apply tracker migrations with pnpm database:migrate.",
  ECONNREFUSED:
    "Check PostgreSQL is running (pnpm services:up) and DATABASE_URL host/port.",
  ENOTFOUND: "Check the DATABASE_URL hostname and DNS resolution.",
  ETIMEDOUT: "Check database connectivity and service availability.",
  "28P01": "Check database credentials in DATABASE_URL.",
  "3D000": "Check that the configured database exists.",
  "42P01": "Check tracker migrations are applied with pnpm database:migrate.",
  "42501": "Check the database role has the required permissions.",
  EPERM: "Check runtime permissions allow database network connections.",
  EACCES: "Check runtime permissions for the requested operation.",
  EADDRINUSE: "Check that WORKER_PORT is available.",
};

/** Find allowlisted codes in bounded cause/aggregate chains without serializing exceptions. */
export function diagnosticCodes(error: unknown): string[] {
  const pending = [error];
  const seen = new Set<unknown>();
  const codes = new Set<string>();
  for (let i = 0; i < pending.length && i < 32; i++) {
    const item = pending[i];
    if (!item || typeof item !== "object" || seen.has(item)) continue;

    seen.add(item);
    const failure = item as {
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
    };

    const domain = trackerErrorCodeSchema.safeParse(failure.code);
    if (domain.success) codes.add(domain.data);
    else if (typeof failure.code === "string" && safeCodes.has(failure.code))
      codes.add(failure.code);

    if (pending.length < 32) pending.push(failure.cause);

    if (Array.isArray(failure.errors))
      pending.push(
        ...failure.errors.slice(0, Math.max(0, 32 - pending.length))
      );
  }

  return [...codes];
}

/** Fixed route templates prevent paths, resource IDs and proof-bearing queries leaking. */
export const safeRoutes = new Set([
  "/api/v1/session",
  "/api/v1/seasons",
  "/api/v1/seasons/:id",
  "/api/v1/history",
  "/api/v1/export",
  "/api/v1/admin/stats",
  "/api/v1/admin/seasons",
  "/api/v1/auth",
  "/api/v1/command",
  "/api/v1/oauth",
  "/api/auth/google/callback",
  "/api/auth/discord/callback",
  "/api/discord",
  "unmatched",
]);

/** Classify an API URL without retaining query strings or user-supplied path segments. */
export function diagnosticRoute(url: string): string {
  const path = new URL(url).pathname;
  if (/^\/api\/v1\/seasons\/[a-f0-9-]{36}$/.test(path))
    return "/api/v1/seasons/:id";

  return safeRoutes.has(path) ? path : "unmatched";
}
