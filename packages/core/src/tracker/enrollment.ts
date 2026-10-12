import type { Transaction, User } from "../model.js";
import { requireRule } from "./shared.js";

/** Build enrollment behavior using the owning service dependencies. */
export function createTrackerEnrollment(_context: Record<string, never>) {
  /** Lock an owned enrollment after its user. */
  async function enrollment(tx: Transaction, user: User, enrollmentId: string) {
    const row = await tx.get("enrollments", enrollmentId, true);
    requireRule(row && row.userId === user.id, "NOT_FOUND");
    return row;
  }

  return enrollment;
}
