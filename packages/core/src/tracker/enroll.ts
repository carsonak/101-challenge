import type { TrackerCommand } from "@challenge/contracts";
import type { Enrollment, Transaction, User } from "../model.js";
import { reportingDate } from "../rules.js";
import type { createTrackerClaimSlot } from "./claimSlot.js";
import { requireRule } from "./shared.js";

/** Build enroll behavior using the owning service dependencies. */
export function createTrackerEnroll(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ defaultZone: string;
  /** Shared service dependency. */ claimSlot: ReturnType<
    typeof createTrackerClaimSlot
  >;
}) {
  const { id, defaultZone, claimSlot } = context;
  async function enroll(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "Enroll") {
      const season = await tx.get("seasons", c.seasonId);
      requireRule(season?.state === "published", "SEASON_UNAVAILABLE");
      const existing = (
        await tx.list("enrollments", { userId: user.id, seasonId: c.seasonId })
      )[0];

      if (existing)
        return { resourceId: existing.id, version: existing.version };

      const row: Enrollment = {
        id: id(),
        userId: user.id,
        seasonId: c.seasonId,
        participation: "active",
        timezone: null,
        registeredDate: reportingDate(new Date(now), defaultZone),
        releaseOn: null,
        currentAttemptId: null,
        hasCompleted: false,
        version: 0,
        createdAt: now,
        updatedAt: now,
      };

      await tx.insert("enrollments", row);
      await claimSlot(tx, row);
      return { resourceId: row.id, version: 0 };
    }
  }

  return enroll;
}
