import type { Attempt, Transaction } from "../model.js";

/** Build hasBackfill behavior using the owning service dependencies. */
export function createTrackerHasBackfill(context: {
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { clock } = context;
  /** A window can be revoked independently of its original fixed deadline. */
  async function hasBackfill(tx: Transaction, row: Attempt) {
    const now = clock().toISOString();
    return Boolean(
      row.backfillUntil &&
      row.backfillUntil > now &&
      (await tx.list("grants", { attemptId: row.id, kind: "backfill" })).some(
        (g) => !g.revokedAt && !g.usedAt && g.expiresAt > now
      )
    );
  }

  return hasBackfill;
}
