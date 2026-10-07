import { trackerErrorCodeSchema } from "@challenge/contracts";

/** Fixed backend events; arbitrary application content is never an event name. */
export type BackendEvent =
  | "http_request"
  | "mail_delivered"
  | "mail_failed"
  | "runtime_ready"
  | "startup_failed"
  | "listening"
  | "shutdown_started"
  | "shutdown_complete"
  | "listener_failed"
  | "queue_failed"
  | "projection_complete"
  | "projection_failed"
  | "housekeeping_complete"
  | "housekeeping_failed"
  | "outbox_complete"
  | "outbox_failed"
  | "discord_action_failed"
  | "discord_delivery_failed"
  | "discord_form_failed";

/** Safe diagnostic metadata; raw requests, errors and configuration are excluded. */
export interface BackendDetails {
  /** Server-generated correlation UUID, never a client-supplied identifier. */
  requestId?: string;
  /** Fixed API route template from diagnosticRoute. */
  route?: string;
  /** Standard HTTP verb; other supplied values are omitted. */
  method?: string;
  /** Completed HTTP response status. */
  status?: number;
  /** Elapsed operation time in milliseconds. */
  durationMs?: number;
  /** Worker listener port, without host or connection configuration. */
  port?: number;
  /** Outbox events successfully delivered in one scan. */
  delivered?: number;
  /** Outbox delivery failures in one scan. */
  failed?: number;
  /** Content-free logical projection processing result. */
  outcome?: "processed" | "duplicate" | "ignored";
}

/** Known transport/database codes identify failures without error messages or SQL. */
const safeCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EADDRINUSE",
  "EACCES",
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
/** Fixed route templates prevent paths, resource IDs and proof-bearing queries leaking. */
const safeRoutes = new Set([
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

/**
 * Write one JSON diagnostic to stdout/stderr using an explicit metadata allowlist.
 * Error messages, stacks, causes, SQL and supplied content are never serialized.
 * A sink can be injected for verification; log failures never fail application work.
 */
export function logBackend(
  service: "web" | "worker",
  event: BackendEvent,
  details: BackendDetails = {},
  error?: unknown,
  sink?: (line: string, level: "info" | "warn" | "error") => void
) {
  try {
    const level =
      (details.status ?? 0) >= 500 ||
      (details.failed ?? 0) > 0 ||
      (details.status === undefined && error !== undefined)
        ? "error"
        : (details.status ?? 0) >= 400
          ? "warn"
          : "info";
    const record: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
    };
    if (details.requestId && /^[a-f0-9-]{36}$/.test(details.requestId))
      record.requestId = details.requestId;
    if (details.route && safeRoutes.has(details.route))
      record.route = details.route;
    if (
      details.method &&
      ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
        details.method
      )
    )
      record.method = details.method;
    for (const key of [
      "status",
      "durationMs",
      "port",
      "delivered",
      "failed",
    ] as const) {
      const value = details[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0)
        record[key] = Math.round(value);
    }
    if (
      details.outcome &&
      ["processed", "duplicate", "ignored"].includes(details.outcome)
    )
      record.outcome = details.outcome;
    if (error !== undefined) {
      const code = (error as { code?: unknown } | null)?.code;
      const domain = trackerErrorCodeSchema.safeParse(code);
      record.errorCode = domain.success
        ? domain.data
        : typeof code === "string" && safeCodes.has(code)
          ? code
          : "INTERNAL";
      const name = (error as { name?: unknown } | null)?.name;
      record.errorKind =
        typeof name === "string" &&
        [
          "Error",
          "TypeError",
          "RangeError",
          "SyntaxError",
          "ZodError",
          "AbortError",
          "TimeoutError",
          "DatabaseError",
        ].includes(name)
          ? name
          : "Error";
    }
    const line = JSON.stringify(record);
    if (sink) sink(line, level);
    else {
      const format = process.env.LOG_FORMAT ?? "auto";
      const pretty =
        format === "pretty" ||
        (format === "auto" &&
          process.env.NODE_ENV !== "production" &&
          Boolean(process.stdout.isTTY));
      console[level](
        pretty
          ? `${record.timestamp} ${level.toUpperCase().padEnd(5)} ${service} · ${event} ${Object.entries(
              record
            )
              .filter(
                ([key]) =>
                  !["timestamp", "level", "service", "event"].includes(key)
              )
              .map(([key, value]) => `${key}=${value}`)
              .join(" ")}`
          : line
      );
    }
  } catch {
    // Diagnostics must not reverse a transaction or prevent an HTTP response.
  }
}
