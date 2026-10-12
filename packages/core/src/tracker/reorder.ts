import type { Attempt, Transaction } from "../model.js";
import { streaks } from "../rules.js";

/** Build reorder behavior using the owning service dependencies. */
export function createTrackerReorder(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
}) {
  const { id } = context;
  /** Rebuild mutable source facts chronologically without replacing immutable completion facts. */
  async function reorder(tx: Transaction, row: Attempt, now: string) {
    const reports = (await tx.list("reports", { attemptId: row.id })).sort(
      (a, b) => a.reportingDate.localeCompare(b.reportingDate)
    );

    const milestones = await tx.list("milestones", {
      attemptId: row.id,
      archived: false,
    });

    const credits = await tx.list("credits", { attemptId: row.id });
    const achievements = new Map(
      reports.flatMap((r) =>
        r.milestoneFacts.map((f) => [f.revisionId, f.achieved] as const)
      )
    );

    for (const [index, r] of reports.entries()) {
      r.reportingIndex = index + 1;
      const boundary = row.streakBreaks
        .filter((b) => b.at < r.createdAt)
        .at(-1)?.date;

      r.streakAtReport = streaks(
        reports
          .slice(0, index + 1)
          .map((v) => v.reportingDate)
          .filter((d) => !boundary || d > boundary),
        r.reportingDate
      ).current;

      r.milestoneFacts = [];
      for (const m of milestones) {
        const rev = await tx.get("milestone_revisions", m.currentRevisionId);
        if (rev?.input.targetReportingDay === index + 1)
          r.milestoneFacts.push({
            revisionId: rev.id,
            achieved:
              rev.input.achievementKind === "reporting_count" ||
              achievements.get(rev.id) === true,
          });
      }

      r.version++;
      r.updatedAt = now;
      await tx.save("reports", r);
      const earned =
        r.streakAtReport > 0 &&
        r.streakAtReport % 7 === 0 &&
        (!row.pausedAt || r.createdAt > row.pausedAt) &&
        row.status !== "paused" &&
        row.status !== "cancelled" &&
        row.status !== "restarted";

      const old = credits.find((c) => c.earningReportId === r.id);
      if (old) {
        old.expired = !earned;
        await tx.save("credits", old);
      } else if (earned)
        await tx.insert("credits", {
          id: id(),
          attemptId: row.id,
          earningReportId: r.id,
          ruleVersion: 1,
          expired: false,
          createdAt: now,
        });
    }

    for (const m of milestones) {
      const rev = await tx.get("milestone_revisions", m.currentRevisionId);
      m.locked = Boolean(rev && rev.input.targetReportingDay <= reports.length);
      await tx.save("milestones", m);
    }
  }

  return reorder;
}
