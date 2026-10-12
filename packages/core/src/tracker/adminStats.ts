import { adminReportSchema } from "@challenge/contracts";
import type { Repository } from "../model.js";
import { activePerkTier, reportingDate, streaks } from "../rules.js";
import type { createTrackerActor } from "./actor.js";
import { mapInOrder, requireRule } from "./shared.js";

/** Build adminStats behavior using the owning service dependencies. */
export function createTrackerAdminStats(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ defaultZone: string;
}) {
  const { repository, actor, clock, defaultZone } = context;
  return {
    /** Administrator projections expose only timestamps/counts/streaks/perks and safe IDs. */
    async adminStats(userId: string) {
      return repository.transaction(async (tx) => {
        requireRule((await actor(tx, userId)).admin, "FORBIDDEN");
        return {
          attempts: await mapInOrder(
            await tx.list("attempts", {}),
            async (a) => {
              const owner = await tx.get("enrollments", a.enrollmentId);
              requireRule(owner, "NOT_FOUND");
              const reports = await tx.list("reports", { attemptId: a.id });
              return {
                id: a.id,
                enrollmentId: a.enrollmentId,
                status: a.status,
                mode: a.mode,
                startedAt: a.startedAt,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
                reportingDays: reports.length,
                currentStreak:
                  a.status === "paused" || a.status === "cancelled"
                    ? 0
                    : streaks(
                        reports
                          .map((r) => r.reportingDate)
                          .filter((d) => !a.streakAfter || d > a.streakAfter),
                        reportingDate(clock(), owner.timezone ?? defaultZone)
                      ).current,
                longestStreak: Math.max(
                  0,
                  ...reports.map((r) => r.streakAtReport)
                ),
                perkTier: ["paused", "cancelled"].includes(a.status)
                  ? 0
                  : activePerkTier(
                      reports.map((r) => r.reportingDate),
                      reportingDate(clock(), owner.timezone ?? defaultZone),
                      a.streakAfter
                    ),
                selectedPerks:
                  a.status === "paused" || a.status === "cancelled"
                    ? []
                    : ["streak_reroll"],
                rerollCredits: (
                  await tx.list("credits", { attemptId: a.id, expired: false })
                ).length,
              };
            }
          ),
          goals: (await tx.list("goals", {})).map((g) => ({
            id: g.id,
            attemptId: g.attemptId,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
            archived: g.archived,
          })),
          milestones: (await tx.list("milestones", {})).map((m) => ({
            id: m.id,
            attemptId: m.attemptId,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            archived: m.archived,
            locked: m.locked,
          })),
          reports: (await tx.list("reports", {})).map((r) =>
            adminReportSchema.parse({
              id: r.id,
              attemptId: r.attemptId,
              reportingDate: r.reportingDate,
              reportingIndex: r.reportingIndex,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
              version: r.version,
            })
          ),
          users: (await tx.list("profiles", {})).map((p) => ({
            id: p.id,
            username: p.username,
          })),
          grants: (await tx.list("grants", {})).map((g) => ({
            id: g.id,
            userId: g.userId,
            attemptId: g.attemptId,
            reportId: g.reportId,
            kind: g.kind,
            expiresAt: g.expiresAt,
            usedAt: g.usedAt,
            revokedAt: g.revokedAt,
            createdAt: g.createdAt,
          })),
        };
      });
    },
  };
}
