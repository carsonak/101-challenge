/** @file Developer CLI diagnostics share backend redaction. Import to report failures; does not perform I/O until called. */
import { diagnosticFailure } from "../packages/core/dist/diagnostics.js";

/** Print an operation, code, redacted message/stack/causes and remediation; never print raw configuration or SQL. */
export function reportCliFailure(operation, error, hint, sink = console.error) {
  const diagnostic = diagnosticFailure(error);
  const next = hint ?? diagnostic.hint;
  if (process.env.LOG_FORMAT === "json") {
    sink(
      JSON.stringify({
        operation,
        ...diagnostic,
        ...(next ? { hint: next } : {}),
      })
    );
    return;
  }
  sink(`[${operation}] ${diagnostic.errorCode}`);
  /** Render already-redacted errors with readable stack lines and nested causes. */
  function render(failure, indent = "") {
    if (!failure || typeof failure !== "object") {
      sink(`${indent}${String(failure)}`);
      return;
    }
    const text =
      failure.stack ??
      `${failure.name ?? "Error"}: ${failure.message ?? "Unknown failure"}`;
    sink(
      String(text)
        .split("\n")
        .map((line) => `${indent}${line}`)
        .join("\n")
    );
    for (const key of ["code", "errno", "syscall"])
      if (failure[key] !== undefined) sink(`${indent}${key}: ${failure[key]}`);
    if (failure.cause !== undefined) {
      sink(`${indent}Caused by:`);
      render(failure.cause, `${indent}  `);
    }
    for (const nested of failure.errors ?? []) {
      sink(`${indent}Nested error:`);
      render(nested, `${indent}  `);
    }
  }
  render(diagnostic.error);
  if (next) sink(`Next: ${next}`);
}
