import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { requireRule } from "./shared.js";

/** Build grantRevoke behavior using the owning service dependencies. */
export function createTrackerGrantRevoke(_context: Record<string, never>) {
  async function grantRevoke(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "RevokeCorrectionGrant") {
      requireRule(user.admin, "FORBIDDEN");
      const grant = await tx.get("grants", c.grantId, true);
      requireRule(grant, "NOT_FOUND");
      grant.revokedAt = now;
      await tx.save("grants", grant);
      return { resourceId: grant.id, version: 0 };
    }
  }

  return grantRevoke;
}
