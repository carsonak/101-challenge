import { ownerReportSchema } from "@challenge/contracts";
import type { Repository } from "../model.js";
import { reportingDate, streaks } from "../rules.js";
import type { createTrackerActor } from "./actor.js";
import { mapInOrder, requireRule } from "./shared.js";

/** Build dailySummary behavior using the owning service dependencies. */
export function createTrackerDailySummary(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ defaultZone: string;
}) {
  const { repository, actor, clock, defaultZone } = context;
  return {
    /** Owner-authorized current enrollment summaries; never load retained attempts or old report bodies. */
    async dailySummary(userId: string) {
      return repository.transaction(async (tx) => {
        await actor(tx, userId);
        return mapInOrder(
          await tx.list("enrollments", { userId }),
          async (e) => {
            const season = await tx.get("seasons", e.seasonId);
            const a = e.currentAttemptId
              ? await tx.get("attempts", e.currentAttemptId)
              : undefined;

            const today = reportingDate(clock(), e.timezone ?? defaultZone);
            const reports = a
              ? await tx.reportSummary(a.id, today)
              : { dates: [], today: undefined };

            const goalRows = a
              ? await tx.list("goals", { attemptId: a.id, archived: false })
              : [];

            const goals = await mapInOrder(goalRows, async (goal) => {
              const revision = await tx.get(
                "goal_revisions",
                goal.currentRevisionId
              );

              requireRule(revision, "NOT_FOUND");
              return {
                id: goal.id,
                revisionId: revision.id,
                ...revision.input,
              };
            });

            // Edits must retain the exact goal revisions captured by the accepted report.
            const applicableGoals = reports.today
              ? await mapInOrder(
                  reports.today.applicableGoalRevisionIds,
                  async (id) => {
                    const revision = await tx.get("goal_revisions", id);
                    requireRule(revision, "NOT_FOUND");
                    return {
                      id: revision.goalId,
                      revisionId: revision.id,
                      ...revision.input,
                    };
                  }
                )
              : goals;

            const milestoneRows = a
              ? await tx.list("milestones", {
                  attemptId: a.id,
                  archived: false,
                })
              : [];

            const milestones = await mapInOrder(
              milestoneRows,
              async (milestone) => {
                const revision = await tx.get(
                  "milestone_revisions",
                  milestone.currentRevisionId
                );

                requireRule(revision, "NOT_FOUND");
                return {
                  id: milestone.id,
                  revisionId: revision.id,
                  ...revision.input,
                };
              }
            );

            const dates = reports.dates
              .map((r) => r.reportingDate)
              .filter((d) => !a?.streakAfter || d > a.streakAfter);

            return {
              id: e.id,
              seasonId: e.seasonId,
              title: season?.title ?? "Season",
              participation: e.participation,
              version: e.version,
              attemptId: a?.id,
              attemptVersion: a?.version,
              attemptState: a?.status,
              today,
              reportingDays: reports.dates.length,
              currentStreak:
                e.participation === "active"
                  ? streaks(dates, today).current
                  : 0,
              longestStreak: Math.max(
                0,
                ...reports.dates.map((r) => r.streakAtReport)
              ),
              goals: applicableGoals,
              milestones,
              report: reports.today
                ? ownerReportSchema.parse({
                    id: reports.today.id,
                    attemptId: reports.today.attemptId,
                    reportingDate: reports.today.reportingDate,
                    reportingIndex: reports.today.reportingIndex,
                    body: reports.today.body,
                    goalValues: reports.today.goalValues,
                    applicableGoalRevisionIds:
                      reports.today.applicableGoalRevisionIds,
                    createdAt: reports.today.createdAt,
                    updatedAt: reports.today.updatedAt,
                    version: reports.today.version,
                  })
                : null,
            };
          }
        );
      });
    },
  };
}
