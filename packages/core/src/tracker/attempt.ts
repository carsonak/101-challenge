import type { Transaction, User } from "../model.js";
import type { createTrackerEnrollment } from "./enrollment.js";
import { requireRule } from "./shared.js";

/** Build attempt behavior using the owning service dependencies. */
export function createTrackerAttempt(context: {
  /** Shared service dependency. */ enrollment: ReturnType<
    typeof createTrackerEnrollment
  >;
}) {
  const { enrollment } = context;
  /** Discover an attempt's parent without locking, then lock enrollment and attempt. */
  async function attempt(tx: Transaction, user: User, attemptId: string) {
    const found = await tx.get("attempts", attemptId);
    requireRule(found, "NOT_FOUND");
    const owner = await enrollment(tx, user, found.enrollmentId);
    const row = await tx.get("attempts", attemptId, true);
    requireRule(row, "NOT_FOUND");
    return { owner, row };
  }

  return attempt;
}
