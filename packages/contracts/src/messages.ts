/** Shared user-facing explanations; never interpolate private/server-supplied errors. */
export const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "This action requires permission or a recent sign-in.",
  NOT_FOUND: "This item is unavailable.",
  VALIDATION: "Check the fields and try again.",
  VERSION_CONFLICT:
    "The challenge changed. Your text is retained; review the latest progress before trying again.",
  ALREADY_REPORTED: "A report already exists for today. You can edit it below.",
  ATTEMPT_CLOSED:
    "This attempt is read-only. Historical edits require a correction key.",
  SEASON_SLOT_OCCUPIED:
    "You already have an unfinished active season. Pause it and wait until the next reporting day, or cancel it on the website.",
  MILESTONE_LOCKED:
    "That milestone is locked because its reporting day was accepted.",
  GRANT_INVALID:
    "The correction key is invalid, expired, revoked or already used.",
  IDEMPOTENCY_CONFLICT:
    "This retry differs from the original request. Review the latest progress.",
  RATE_LIMITED: "Too many requests. Please wait before trying again.",
  oauth: "Sign-in could not be completed. Please try again.",
};

/** Return safe copy for an unknown or stable error code. */
export function errorMessage(code: unknown) {
  return typeof code === "string"
    ? (errorMessages[code] ??
        "The service is unavailable. Please try again shortly.")
    : "The service is unavailable. Please try again shortly.";
}
