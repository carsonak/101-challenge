import type { Enrollment, Transaction } from "../model.js";

/** Build releaseSlot behavior using the owning service dependencies. */
export function createTrackerReleaseSlot(_context: Record<string, never>) {
  /** Release only the slot held by this enrollment. */
  async function releaseSlot(tx: Transaction, row: Enrollment) {
    const slot = await tx.get("slots", row.userId);
    if (slot?.enrollmentId === row.id) await tx.remove("slots", row.userId);
  }

  return releaseSlot;
}
