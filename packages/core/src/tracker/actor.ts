import type { Transaction } from "../model.js";
import { requireRule } from "./shared.js";

/** Build actor behavior using the owning service dependencies. */
export function createTrackerActor(_context: Record<string, never>) {
  /** Load the authenticated user and serialize that user's mutations first. */
  async function actor(tx: Transaction, userId: string) {
    const user = await tx.get("users", userId, true);
    requireRule(user, "UNAUTHENTICATED");
    requireRule(
      !(await tx.list("erasure_requests", { userId, processedAt: null })).some(
        (r) => !r.cancelledAt
      ),
      "FORBIDDEN"
    );

    return user;
  }

  return actor;
}
