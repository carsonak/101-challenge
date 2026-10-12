import type { TrackerCommand } from "@challenge/contracts";
import type { Report, Transaction, User } from "../model.js";
import { reportingDate, streaks } from "../rules.js";
import type { createTrackerAttempt } from "./attempt.js";
import type { createTrackerEligibleDate } from "./eligibleDate.js";
import type { createTrackerHasBackfill } from "./hasBackfill.js";
import type { createTrackerReleaseSlot } from "./releaseSlot.js";
import type { createTrackerReorder } from "./reorder.js";
import { requireRule } from "./shared.js";
import type { createTrackerValidateValues } from "./validateValues.js";

/** Build reportSubmit behavior using the owning service dependencies. */
export function createTrackerReportSubmit(context: {
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
  /** Shared service dependency. */ defaultZone: string;
  /** Shared service dependency. */ hasBackfill: ReturnType<
    typeof createTrackerHasBackfill
  >;
  /** Shared service dependency. */ eligibleDate: ReturnType<
    typeof createTrackerEligibleDate
  >;
  /** Shared service dependency. */ validateValues: ReturnType<
    typeof createTrackerValidateValues
  >;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ releaseSlot: ReturnType<
    typeof createTrackerReleaseSlot
  >;
  /** Shared service dependency. */ reorder: ReturnType<
    typeof createTrackerReorder
  >;
}) {
  const {
    attempt,
    defaultZone,
    hasBackfill,
    eligibleDate,
    validateValues,
    id,
    releaseSlot,
    reorder,
  } = context;

  async function reportSubmit(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "SubmitReport" || c.command === "BackfillReport") {
      const { owner, row } = await attempt(tx, user, c.attemptId);
      requireRule(row.version === c.expectedAttemptVersion, "VERSION_CONFLICT");
      requireRule(row.status === "active", "ATTEMPT_CLOSED");
      const date =
        c.command === "BackfillReport"
          ? c.reportingDate
          : reportingDate(new Date(now), owner.timezone ?? defaultZone);

      if (c.command === "BackfillReport") {
        requireRule(await hasBackfill(tx, row), "GRANT_INVALID");
        await eligibleDate(tx, owner, date, now);
      }

      const reports = await tx.list("reports", { attemptId: row.id });
      requireRule(
        !reports.some((r) => r.reportingDate === date),
        "ALREADY_REPORTED"
      );

      const count = reports.length + 1;
      const reportingIndex =
        reports.filter((r) => r.reportingDate < date).length + 1;

      requireRule(count <= 101, "ATTEMPT_CLOSED");
      await validateValues(tx, row, c.goalValues);
      const facts: Report["milestoneFacts"] = [];
      for (const milestone of await tx.list("milestones", {
        attemptId: row.id,
        archived: false,
      })) {
        const revision = await tx.get(
          "milestone_revisions",
          milestone.currentRevisionId
        );

        requireRule(revision, "VALIDATION");
        if (revision.input.targetReportingDay === reportingIndex) {
          facts.push({
            revisionId: revision.id,
            achieved:
              revision.input.achievementKind === "reporting_count" ||
              c.milestoneAchievements.includes(milestone.id),
          });

          milestone.locked = true;
          milestone.updatedAt = now;
          await tx.save("milestones", milestone);
        }
      }

      for (const milestoneId of c.milestoneAchievements) {
        const milestone = await tx.get("milestones", milestoneId);
        const revision = milestone
          ? await tx.get("milestone_revisions", milestone.currentRevisionId)
          : undefined;

        requireRule(
          milestone?.attemptId === row.id &&
            !milestone.archived &&
            revision?.input.targetReportingDay === reportingIndex &&
            revision.input.achievementKind === "manual",
          "VALIDATION"
        );
      }

      const run = streaks(
        [...reports.map((r) => r.reportingDate), date].filter(
          (d) => !row.streakAfter || d > row.streakAfter
        ),
        date
      ).trailing;

      const accepted: Report = {
        id: id(),
        attemptId: row.id,
        reportingDate: date,
        reportingIndex: count,
        body: c.body,
        goalValues: c.goalValues,
        milestoneFacts: facts,
        selectedPerks: ["streak_reroll"],
        streakAtReport: run,
        applicableGoalRevisionIds: (
          await tx.list("goals", { attemptId: row.id, archived: false })
        ).map((g) => g.currentRevisionId),
        version: 0,
        createdAt: now,
        updatedAt: now,
      };

      await tx.insert("reports", accepted);
      if (run > 0 && run % 7 === 0)
        await tx.insert("credits", {
          id: id(),
          attemptId: row.id,
          earningReportId: accepted.id,
          ruleVersion: 1,
          expired: false,
          createdAt: now,
        });

      row.version++;
      row.sourceVersion++;
      row.updatedAt = now;
      if (count === 101) {
        row.status = "completed";
        owner.participation = "completed";
        owner.version++;
        owner.updatedAt = now;
        if (!owner.hasCompleted) {
          await tx.insert("entitlements", {
            id: id(),
            enrollmentId: owner.id,
            attemptId: row.id,
            completedAt: now,
            reportingDates: [
              ...reports
                .sort((a, b) => a.reportingIndex - b.reportingIndex)
                .map((r) => r.reportingDate),
              date,
            ].sort(),
          });

          owner.hasCompleted = true;
        }

        await releaseSlot(tx, owner);
        await tx.save("enrollments", owner);
      }

      await tx.save("attempts", row);
      if (c.command === "BackfillReport") await reorder(tx, row, now);

      return { resourceId: accepted.id, version: accepted.version };
    }
  }

  return reportSubmit;
}
