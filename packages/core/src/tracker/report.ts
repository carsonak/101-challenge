import type { Transaction, User } from "../model.js";
import type { createTrackerAttempt } from "./attempt.js";
import { requireRule } from "./shared.js";

/** Build report behavior using the owning service dependencies. */
export function createTrackerReport(context: {
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
}) {
  const { attempt } = context;
  /** Serialize report mutation under its owner, enrollment and attempt locks. */
  async function report(tx: Transaction, user: User, reportId: string) {
    const found = await tx.get("reports", reportId);
    requireRule(found, "NOT_FOUND");
    const context = await attempt(tx, user, found.attemptId);
    const row = await tx.get("reports", reportId, true);
    requireRule(row, "NOT_FOUND");
    return { ...context, report: row };
  }

  return report;
}
