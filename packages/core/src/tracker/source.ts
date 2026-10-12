import { attemptSourceV1Schema } from "@challenge/contracts/source";
import type { Repository } from "../model.js";
import type { createTrackerActor } from "./actor.js";
import type { createTrackerAttempt } from "./attempt.js";
import { mapInOrder, requireRule } from "./shared.js";

/** Build source behavior using the owning service dependencies. */
export function createTrackerSource(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
}) {
  const { repository, actor, attempt } = context;
  return {
    /** Private server-only source provider; never attach this method to a transport endpoint. */
    async source(userId: string, attemptId: string) {
      return repository.transaction(async (tx) => {
        const user = await actor(tx, userId);
        const { owner, row } = await attempt(tx, user, attemptId);
        requireRule(!row.erased, "NOT_FOUND");
        const completion = (
          await tx.list("entitlements", { enrollmentId: owner.id })
        )[0];

        return attemptSourceV1Schema.parse({
          schemaVersion: 1,
          userId,
          enrollmentId: owner.id,
          seasonId: owner.seasonId,
          attemptId: row.id,
          attemptMode: row.mode,
          status: row.status,
          timezone: owner.timezone,
          startedAt: row.startedAt,
          baseSeed: row.baseSeed,
          seedVersion: row.seedVersion,
          sourceVersion: row.sourceVersion,
          initialGoals: row.initialGoals,
          initialMilestones: row.initialMilestones,
          reports: await mapInOrder(
            await tx.list("reports", { attemptId: row.id }),
            async (report) => ({
              ...report,
              goalRevisionFacts: await mapInOrder(
                report.applicableGoalRevisionIds,
                async (revisionId) => {
                  const revision = await tx.get("goal_revisions", revisionId);
                  requireRule(revision, "NOT_FOUND");
                  return { revisionId, input: revision.input };
                }
              ),
              milestoneFacts: await mapInOrder(
                report.milestoneFacts,
                async (fact) => {
                  const revision = await tx.get(
                    "milestone_revisions",
                    fact.revisionId
                  );

                  requireRule(revision, "NOT_FOUND");
                  return { ...fact, input: revision.input };
                }
              ),
            })
          ),
          completion: completion
            ? {
                entitlementId: completion.id,
                completedAttemptId: completion.attemptId,
                completedAt: completion.completedAt,
                reportingDates: completion.reportingDates,
              }
            : null,
        });
      });
    },
  };
}
