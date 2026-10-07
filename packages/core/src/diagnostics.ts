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
  /** Sensitive values to remove from exception text; never emitted as metadata. */
  redact?: readonly string[];
  /** Server-generated correlation UUID, never a client-supplied identifier. */
  requestId?: string;
  /** Fixed worker startup operation that failed. */
  stage?:
    "configuration" | "database_readiness" | "queue_start" | "job_registration";
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
const errorHints: Record<string, string> = {
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
function diagnosticCodes(error: unknown): string[] {
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

/** Preserve exception diagnostics while removing known secrets and proof-bearing URLs. */
function exceptionDetails(
  error: unknown,
  secrets: readonly string[] = []
): unknown {
  const seen = new Set<unknown>();
  const configured = Object.entries(process.env)
    .filter(([key]) =>
      /PASSWORD|SECRET|TOKEN|PRIVATE_KEY|DATABASE_URL/.test(key)
    )
    .flatMap(([, value]) => (value ? [value] : []));
  const redact = (value: string) => {
    let text = value;
    for (const secret of [...secrets, ...configured])
      if (secret) text = text.split(secret).join("[REDACTED]");
    return text
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
      .replace(
        /([?&](?:token|code|key|password|secret|recoveryEmail)=)[^\s&#]*/gi,
        "$1[REDACTED]"
      )
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[REDACTED_EMAIL]");
  };
  const visit = (value: unknown, depth: number): unknown => {
    if (depth >= 8) return "[Depth limit]";
    if (!value || typeof value !== "object")
      return typeof value === "string" ? redact(value) : String(value);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of ["name", "message", "stack", "code", "errno", "syscall"])
      if (typeof source[key] === "string") result[key] = redact(source[key]);
      else if (typeof source[key] === "number") result[key] = source[key];
    if (source.cause !== undefined)
      result.cause = visit(source.cause, depth + 1);
    if (Array.isArray(source.errors))
      result.errors = source.errors
        .slice(0, 16)
        .map((item) => visit(item, depth + 1));
    return result;
  };
  return visit(error, 0);
}

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
 * Includes exception messages, stacks and causes for operators, with targeted secret
 * redaction. Request bodies and arbitrary exception properties are not serialized.
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
    if (
      details.stage &&
      [
        "configuration",
        "database_readiness",
        "queue_start",
        "job_registration",
      ].includes(details.stage)
    )
      record.stage = details.stage;
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
      record.error = exceptionDetails(error, details.redact);
      const codes = diagnosticCodes(error);
      record.errorCode = codes[0] ?? "INTERNAL";
      if (codes.length > 1) record.errorCodes = codes;
      const hint = errorHints[codes[0] ?? ""];
      if (hint) record.hint = hint;
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
              .map(
                ([key, value]) =>
                  `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`
              )
              .join(" ")}`
          : line
      );
    }
  } catch {
    // Diagnostics must not reverse a transaction or prevent an HTTP response.
  }
}
