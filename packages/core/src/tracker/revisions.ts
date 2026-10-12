import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import type { createTrackerAttempt } from "./attempt.js";
import type { createTrackerHasBackfill } from "./hasBackfill.js";
import type { createTrackerReorder } from "./reorder.js";
import { requireRule } from "./shared.js";

/** Build revisions behavior using the owning service dependencies. */
export function createTrackerRevisions(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
  /** Shared service dependency. */ hasBackfill: ReturnType<
    typeof createTrackerHasBackfill
  >;
  /** Shared service dependency. */ reorder: ReturnType<
    typeof createTrackerReorder
  >;
}) {
  const { id, attempt, hasBackfill, reorder } = context;
  async function revisions(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (
      c.command === "SaveGoal" ||
      c.command === "ArchiveGoal" ||
      c.command === "SaveMilestone" ||
      c.command === "ArchiveMilestone"
    ) {
      const { row } = await attempt(tx, user, c.attemptId);
      requireRule(
        row.status === "active" ||
          (row.status === "completed" && (await hasBackfill(tx, row))),
        "ATTEMPT_CLOSED"
      );

      requireRule(row.version === c.expectedAttemptVersion, "VERSION_CONFLICT");
      if (c.command === "SaveGoal" || c.command === "ArchiveGoal") {
        const goal = c.goalId ? await tx.get("goals", c.goalId) : undefined;
        if (c.goalId)
          requireRule(
            goal?.attemptId === row.id && !goal.archived,
            "NOT_FOUND"
          );

        const goals = await tx.list("goals", { attemptId: row.id });
        if (c.command === "SaveGoal" && !goal)
          requireRule(goals.length < 20, "VALIDATION");

        const old = goal
          ? await tx.get("goal_revisions", goal.currentRevisionId)
          : undefined;

        const revisionId = id();
        const input = c.command === "SaveGoal" ? c.goal : old?.input;
        requireRule(input, "NOT_FOUND");
        const saved = goal ?? {
          id: id(),
          attemptId: row.id,
          currentRevisionId: revisionId,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };

        saved.currentRevisionId = revisionId;
        saved.archived = c.command === "ArchiveGoal";
        saved.updatedAt = now;
        if (goal) await tx.save("goals", saved);
        else await tx.insert("goals", saved);

        await tx.insert("goal_revisions", {
          id: revisionId,
          goalId: saved.id,
          attemptId: row.id,
          input,
          archived: saved.archived,
          createdAt: now,
        });
      } else {
        const milestone = c.milestoneId
          ? await tx.get("milestones", c.milestoneId)
          : undefined;

        if (c.milestoneId)
          requireRule(
            milestone?.attemptId === row.id && !milestone.archived,
            "NOT_FOUND"
          );

        const backfill = await hasBackfill(tx, row);
        requireRule(!milestone?.locked || backfill, "MILESTONE_LOCKED");
        const old = milestone
          ? await tx.get("milestone_revisions", milestone.currentRevisionId)
          : undefined;

        const input = c.command === "SaveMilestone" ? c.milestone : old?.input;
        requireRule(input, "NOT_FOUND");
        const reports = await tx.list("reports", { attemptId: row.id });
        requireRule(
          input.targetReportingDay > reports.length || backfill,
          "MILESTONE_LOCKED"
        );

        if (input.goalId) {
          const goal = await tx.get("goals", input.goalId);
          requireRule(
            goal?.attemptId === row.id && !goal.archived,
            "VALIDATION"
          );
        }

        if (!milestone)
          requireRule(
            (
              await tx.list("milestones", {
                attemptId: row.id,
                archived: false,
              })
            ).length < 101,
            "VALIDATION"
          );

        const revisionId = id();
        const saved = milestone ?? {
          id: id(),
          attemptId: row.id,
          currentRevisionId: revisionId,
          archived: false,
          locked: false,
          createdAt: now,
          updatedAt: now,
        };

        saved.currentRevisionId = revisionId;
        saved.archived = c.command === "ArchiveMilestone";
        saved.updatedAt = now;
        if (milestone) await tx.save("milestones", saved);
        else await tx.insert("milestones", saved);

        await tx.insert("milestone_revisions", {
          id: revisionId,
          milestoneId: saved.id,
          attemptId: row.id,
          input,
          archived: saved.archived,
          createdAt: now,
        });
      }

      row.version++;
      row.sourceVersion++;
      row.updatedAt = now;
      await tx.save("attempts", row);
      if (await hasBackfill(tx, row)) await reorder(tx, row, now);

      return { resourceId: row.id, version: row.version };
    }
  }

  return revisions;
}
