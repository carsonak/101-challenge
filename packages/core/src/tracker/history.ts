import {
  enrollmentSchema,
  ownerReportSchema,
  progressSchema,
} from "@challenge/contracts";
import type { Repository } from "../model.js";
import { activePerkTier, reportingDate, streaks } from "../rules.js";
import type { createTrackerActor } from "./actor.js";
import type { createTrackerHasBackfill } from "./hasBackfill.js";
import { mapInOrder } from "./shared.js";

/** Build history behavior using the owning service dependencies. */
export function createTrackerHistory(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ defaultZone: string;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ hasBackfill: ReturnType<
    typeof createTrackerHasBackfill
  >;
}) {
  const { repository, actor, defaultZone, clock, hasBackfill } = context;
  return {
    /** Owner history with safe enrollment metadata and retained attempts/revisions/reports. */
    async history(userId: string) {
      return repository.transaction(async (tx) => {
        const user = await actor(tx, userId);
        const rows = await tx.list("enrollments", { userId: user.id });
        return mapInOrder(rows, async (e) => ({
          ...enrollmentSchema.parse({
            id: e.id,
            registeredDate: e.registeredDate,
            releaseOn: e.releaseOn,
            seasonId: e.seasonId,
            participation: e.participation,
            timezone: e.timezone,
            currentAttemptId: e.currentAttemptId,
            hasCompleted: e.hasCompleted,
            version: e.version,
          }),
          reportingTimezone: e.timezone ?? defaultZone,
          earliestReportingDate:
            [
              e.registeredDate,
              reportingDate(
                new Date(
                  (await tx.get("seasons", e.seasonId))?.publishedAt ??
                    e.createdAt
                ),
                e.timezone ?? defaultZone
              ),
            ]
              .sort()
              .at(-1) ?? e.registeredDate,
          completion:
            (await tx.list("entitlements", { enrollmentId: e.id })).map(
              (entitlement) => ({
                id: entitlement.id,
                attemptId: entitlement.attemptId,
                completedAt: entitlement.completedAt,
                reportingDates: entitlement.reportingDates,
              })
            )[0] ?? null,
          attempts: await mapInOrder(
            await tx.list("attempts", { enrollmentId: e.id }),
            async (a) => {
              const reports = (
                await tx.list("reports", { attemptId: a.id })
              ).sort((l, r) => l.reportingIndex - r.reportingIndex);

              return {
                ...progressSchema.parse({
                  enrollmentId: e.id,
                  attemptId: a.id,
                  participation: e.participation,
                  attemptState: a.status,
                  mode: a.mode,
                  reportingDays: reports.length,
                  currentStreak:
                    a.status === "paused" || a.status === "cancelled"
                      ? 0
                      : streaks(
                          reports
                            .map((r) => r.reportingDate)
                            .filter((d) => !a.streakAfter || d > a.streakAfter),
                          reportingDate(clock(), e.timezone ?? defaultZone)
                        ).current,
                  perkTier: ["paused", "cancelled"].includes(a.status)
                    ? 0
                    : activePerkTier(
                        reports.map((r) => r.reportingDate),
                        reportingDate(clock(), e.timezone ?? defaultZone),
                        a.streakAfter
                      ),
                  longestStreak: Math.max(
                    0,
                    ...reports.map((r) => r.streakAtReport)
                  ),
                  rerollCredits: (
                    await tx.list("credits", {
                      attemptId: a.id,
                      expired: false,
                    })
                  ).length,
                  version: a.version,
                }),
                startedAt: a.startedAt,
                backfillDeadline: a.backfillUntil,
                backfillThrough: reportingDate(
                  new Date(a.createdAt),
                  e.timezone ?? defaultZone
                ),
                backfillUntil: (await hasBackfill(tx, a))
                  ? a.backfillUntil
                  : null,
                erased: a.erased,
                today: reportingDate(clock(), e.timezone ?? defaultZone),
                goals: await tx.list("goals", { attemptId: a.id }),
                goalRevisions: await tx.list("goal_revisions", {
                  attemptId: a.id,
                }),
                milestones: await tx.list("milestones", {
                  attemptId: a.id,
                }),
                milestoneRevisions: await tx.list("milestone_revisions", {
                  attemptId: a.id,
                }),
                reports: reports.map((r) =>
                  ownerReportSchema.parse({
                    id: r.id,
                    attemptId: r.attemptId,
                    reportingDate: r.reportingDate,
                    reportingIndex: r.reportingIndex,
                    body: r.body,
                    goalValues: r.goalValues,
                    applicableGoalRevisionIds: r.applicableGoalRevisionIds,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                    version: r.version,
                  })
                ),
              };
            }
          ),
        }));
      });
    },
  };
}
