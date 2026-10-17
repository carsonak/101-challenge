import { adminReportSchema } from "@challenge/contracts";
import type { Repository, Tables } from "../model.js";
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
    /** Search participant handles with a bounded metadata-only page, after administrator authorization. */
    async adminParticipants(
      userId: string,
      prefix = "",
      after?: string,
      limit = 25
    ) {
      return repository.transaction(async (tx) => {
        requireRule((await actor(tx, userId)).admin, "FORBIDDEN");
        requireRule(
          prefix.length <= 40 &&
            (!after ||
              /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
                after
              )) &&
            Number.isInteger(limit) &&
            limit >= 1 &&
            limit <= 100,
          "VALIDATION"
        );

        const rows = await tx.participantPage(
          prefix.toLowerCase(),
          after,
          limit + 1
        );

        return {
          items: rows.slice(0, limit),
          nextCursor:
            rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
        };
      });
    },
    /** Administrator projections expose only timestamps/counts/streaks/perks and safe IDs. */
    async adminStats(
      userId: string,
      scope?: { participantId: string; after?: string; limit?: number }
    ) {
      return repository.transaction(async (tx) => {
        requireRule((await actor(tx, userId)).admin, "FORBIDDEN");
        const limit = Math.min(20, Math.max(1, scope?.limit ?? 20));
        const rows = scope
          ? await tx.participantAttempts(
              scope.participantId,
              scope.after,
              limit + 1
            )
          : await tx.list("attempts", {});

        const attempts = rows.slice(0, scope ? limit : rows.length);
        const profile = scope
          ? await tx.get("profiles", scope.participantId)
          : undefined;

        if (scope) requireRule(profile, "NOT_FOUND");

        const related = async <K extends "goals" | "milestones" | "grants">(
          table: K
        ) => {
          if (!scope) return tx.list(table, {});

          return (
            await mapInOrder(attempts, (a) =>
              tx.list(table, { attemptId: a.id } as Partial<Tables[K]>)
            )
          ).flat();
        };

        const reportRows = scope
          ? (await mapInOrder(attempts, (a) => tx.reportMetadata(a.id))).flat()
          : await tx.list("reports", {});

        return {
          nextCursor:
            scope && rows.length > limit ? (attempts.at(-1)?.id ?? null) : null,
          attempts: await mapInOrder(attempts, async (a) => {
            const owner = await tx.get("enrollments", a.enrollmentId);
            requireRule(owner, "NOT_FOUND");
            const dates = reportRows.filter((r) => r.attemptId === a.id);
            return {
              id: a.id,
              enrollmentId: a.enrollmentId,
              status: a.status,
              mode: a.mode,
              startedAt: a.startedAt,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
              reportingDays: dates.length,
              currentStreak:
                a.status === "paused" || a.status === "cancelled"
                  ? 0
                  : streaks(
                      dates
                        .map((r) => r.reportingDate)
                        .filter((d) => !a.streakAfter || d > a.streakAfter),
                      reportingDate(clock(), owner.timezone ?? defaultZone)
                    ).current,
              longestStreak: Math.max(0, ...dates.map((r) => r.streakAtReport)),
              perkTier: ["paused", "cancelled"].includes(a.status)
                ? 0
                : activePerkTier(
                    dates.map((r) => r.reportingDate),
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
          }),
          goals: (await related("goals")).map((g) => ({
            id: g.id,
            attemptId: g.attemptId,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
            archived: g.archived,
          })),
          milestones: (await related("milestones")).map((m) => ({
            id: m.id,
            attemptId: m.attemptId,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            archived: m.archived,
            locked: m.locked,
          })),
          reports: reportRows.map((r) =>
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
          users: (profile ? [profile] : await tx.list("profiles", {})).map(
            (p) => ({
              id: p.id,
              username: p.username,
            })
          ),
          grants: (await related("grants")).map((g) => ({
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
