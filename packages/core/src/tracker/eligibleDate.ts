import type { Enrollment, Transaction } from "../model.js";
import { reportingDate } from "../rules.js";
import { requireRule } from "./shared.js";

/** Build eligibleDate behavior using the owning service dependencies. */
export function createTrackerEligibleDate(context: {
  /** Shared service dependency. */ defaultZone: string;
}) {
  const { defaultZone } = context;
  /** Historical edits respect both registration and first-publication local dates. */
  async function eligibleDate(
    tx: Transaction,
    owner: Enrollment,
    date: string,
    now: string
  ) {
    const season = await tx.get("seasons", owner.seasonId);
    requireRule(season?.publishedAt, "SEASON_UNAVAILABLE");
    const zone = owner.timezone ?? defaultZone;
    requireRule(
      date >= owner.registeredDate &&
        date >= reportingDate(new Date(season.publishedAt), zone) &&
        date <= reportingDate(new Date(now), zone),
      "VALIDATION"
    );
  }

  return eligibleDate;
}
