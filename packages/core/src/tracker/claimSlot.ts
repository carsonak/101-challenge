import type { Enrollment, Transaction } from "../model.js";
import { reportingDate } from "../rules.js";
import { requireRule } from "./shared.js";

/** Build claimSlot behavior using the owning service dependencies. */
export function createTrackerClaimSlot(context: {
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ defaultZone: string;
}) {
  const { clock, defaultZone } = context;
  /** Claim the one unfinished-season slot while holding the user lock. */
  async function claimSlot(tx: Transaction, row: Enrollment) {
    if (row.hasCompleted) return;

    let slot = await tx.get("slots", row.userId);
    if (slot && slot.enrollmentId !== row.id) {
      const held = await tx.get("enrollments", slot.enrollmentId, true);
      if (
        held?.participation === "paused" &&
        held.releaseOn &&
        held.releaseOn <= reportingDate(clock(), held.timezone ?? defaultZone)
      ) {
        await tx.remove("slots", row.userId);
        slot = undefined;
      }
    }

    requireRule(!slot || slot.enrollmentId === row.id, "SEASON_SLOT_OCCUPIED");
    if (!slot)
      await tx.insert("slots", { id: row.userId, enrollmentId: row.id });
  }

  return claimSlot;
}
