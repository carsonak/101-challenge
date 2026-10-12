import { diagnosticCodes, errorHints } from "./classification.js";

/** Preserve exception diagnostics while removing known secrets and proof-bearing URLs. */
export function exceptionDetails(
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

/** Return redacted exception, stack/cause chain, recognized codes and a fixed operator hint. Never serialize SQL or arbitrary properties. */
export function diagnosticFailure(
  error: unknown,
  secrets: readonly string[] = []
) {
  const codes = diagnosticCodes(error);
  const hint = errorHints[codes[0] ?? ""];
  return {
    error: exceptionDetails(error, secrets),
    errorCode: codes[0] ?? "INTERNAL",
    ...(codes.length > 1 ? { errorCodes: codes } : {}),
    ...(hint ? { hint } : {}),
  };
}
