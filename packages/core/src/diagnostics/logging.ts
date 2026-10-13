import { safeRoutes } from "./classification.js";
import { diagnosticFailure } from "./redaction.js";
import type { BackendDetails, BackendEvent } from "./types.js";

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

    for (const key of ["databaseReady", "jobsReady"] as const)
      if (typeof details[key] === "boolean") record[key] = details[key];

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
      Object.assign(record, diagnosticFailure(error, details.redact));
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
