import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { digest, reportingDate } from "../rules.js";
import type { createTrackerEligibleDate } from "./eligibleDate.js";
import type { createTrackerHasBackfill } from "./hasBackfill.js";
import type { createTrackerReorder } from "./reorder.js";
import type { createTrackerReport } from "./report.js";
import { requireRule } from "./shared.js";
import type { createTrackerValidateValues } from "./validateValues.js";

/** Build reportEdit behavior using the owning service dependencies. */
export function createTrackerReportEdit(context: {
  /** Shared service dependency. */ report: ReturnType<
    typeof createTrackerReport
  >;
  /** Shared service dependency. */ hasBackfill: ReturnType<
    typeof createTrackerHasBackfill
  >;
  /** Default reporting zone for legacy enrollments without a frozen zone. */ defaultZone: string;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ eligibleDate: ReturnType<
    typeof createTrackerEligibleDate
  >;
  /** Shared service dependency. */ validateValues: ReturnType<
    typeof createTrackerValidateValues
  >;
  /** Shared service dependency. */ reorder: ReturnType<
    typeof createTrackerReorder
  >;
}) {
  const {
    report,
    hasBackfill,
    defaultZone,
    clock,
    eligibleDate,
    validateValues,
    reorder,
  } = context;

  async function reportEdit(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "EditReport" || c.command === "CorrectReport") {
      const context = await report(tx, user, c.reportId);
      const { row, owner } = context;
      const saved = context.report;
      requireRule(
        saved.version === c.expectedReportVersion,
        "VERSION_CONFLICT"
      );

      if (c.command === "EditReport")
        requireRule(
          (row.status === "active" || row.status === "completed") &&
            saved.reportingDate ===
              reportingDate(new Date(now), owner.timezone ?? defaultZone),
          "ATTEMPT_CLOSED"
        );
      else if (c.key || !(await hasBackfill(tx, row))) {
        requireRule(c.key, "GRANT_INVALID");
        const foundGrant = (
          await tx.list("grants", { tokenHash: digest(c.key) })
        )[0];

        const grant = foundGrant
          ? await tx.get("grants", foundGrant.id, true)
          : undefined;

        const checkedAt = clock().toISOString();
        requireRule(
          grant &&
            grant.userId === user.id &&
            grant.attemptId === row.id &&
            (!grant.reportId || grant.reportId === saved.id) &&
            !grant.revokedAt &&
            !grant.usedAt &&
            grant.expiresAt > checkedAt,
          "GRANT_INVALID"
        );

        if (grant.kind === "single_report") {
          grant.usedAt = now;
          await tx.save("grants", grant);
        }
      }

      if (
        c.command === "CorrectReport" &&
        c.reportingDate &&
        c.reportingDate !== saved.reportingDate
      ) {
        await eligibleDate(tx, owner, c.reportingDate, now);
        requireRule(
          !(await tx.list("reports", { attemptId: row.id })).some(
            (r) => r.id !== saved.id && r.reportingDate === c.reportingDate
          ),
          "ALREADY_REPORTED"
        );

        saved.reportingDate = c.reportingDate;
      }

      await validateValues(tx, row, c.goalValues, saved);
      saved.body = c.body;
      saved.goalValues = c.goalValues;
      saved.updatedAt = now;
      saved.version++;
      row.sourceVersion++;
      row.version++;
      row.updatedAt = now;
      await tx.save("reports", saved);
      await tx.save("attempts", row);
      if (c.command === "CorrectReport" && c.reportingDate)
        await reorder(tx, row, now);

      return { resourceId: saved.id, version: saved.version };
    }
  }

  return reportEdit;
}
