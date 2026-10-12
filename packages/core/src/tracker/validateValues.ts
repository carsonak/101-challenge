import type { Attempt, Report, Transaction } from "../model.js";
import { requireRule } from "./shared.js";

/** Build validateValues behavior using the owning service dependencies. */
export function createTrackerValidateValues(_context: Record<string, never>) {
  /** Validate values against current revisions for submissions and retained applicable revisions for edits. */
  async function validateValues(
    tx: Transaction,
    row: Attempt,
    values: Report["goalValues"],
    prior?: Report
  ) {
    for (const value of values) {
      const revision = await tx.get("goal_revisions", value.goalRevisionId);
      requireRule(
        revision?.attemptId === row.id &&
          !revision.archived &&
          revision.input.kind !== "qualitative",
        "VALIDATION"
      );

      const goal = await tx.get("goals", revision.goalId);
      if (!prior)
        requireRule(
          goal && !goal.archived && goal.currentRevisionId === revision.id,
          "VALIDATION"
        );
      else {
        requireRule(
          prior.applicableGoalRevisionIds.includes(revision.id),
          "VALIDATION"
        );
      }
    }
  }

  return validateValues;
}
