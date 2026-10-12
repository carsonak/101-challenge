import type {
  Attempt,
  Enrollment,
  GoalInput,
  MilestoneInput,
  Transaction,
  User,
} from "../model.js";
import { deriveAttemptSeed } from "../rules.js";
import type { createTrackerClaimSlot } from "./claimSlot.js";
import { requireRule } from "./shared.js";

/** Build start behavior using the owning service dependencies. */
export function createTrackerStart(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ claimSlot: ReturnType<
    typeof createTrackerClaimSlot
  >;
}) {
  const { id, claimSlot } = context;
  /** Atomically create immutable seed inputs and initial retained revisions. */
  async function start(
    tx: Transaction,
    user: User,
    owner: Enrollment,
    timezone: string,
    goals: GoalInput[],
    milestones: MilestoneInput[],
    now: string
  ) {
    requireRule(!owner.timezone || owner.timezone === timezone, "VALIDATION");
    const season = await tx.get("seasons", owner.seasonId);
    requireRule(season?.state === "published", "SEASON_UNAVAILABLE");
    const prior = await tx.list("attempts", { enrollmentId: owner.id });
    const sequence = prior.reduce((max, a) => Math.max(max, a.sequence), 0) + 1;
    const startedAt = prior.some((a) => a.startedAt === now)
      ? new Date(Date.parse(now) + sequence).toISOString()
      : now;

    const row: Attempt = {
      id: id(),
      enrollmentId: owner.id,
      sequence,
      status: "active",
      pausedAt: null,
      streakAfter: null,
      streakBreaks: [],
      backfillUntil: null,
      erased: false,
      mode: owner.hasCompleted ? "progress_only" : "qualifying",
      ...deriveAttemptSeed(
        user.participantSeed,
        season.seasonSeed,
        startedAt,
        goals,
        milestones
      ),
      seedVersion: "attempt-v1",
      initialGoals: goals,
      initialMilestones: milestones,
      startedAt,
      sourceVersion: 1,
      version: 0,
      createdAt: now,
      updatedAt: now,
    };

    await tx.insert("attempts", row);
    const goalIds: string[] = [];
    for (const input of goals) {
      const goalId = id(),
        revisionId = id();

      goalIds.push(goalId);
      await tx.insert("goals", {
        id: goalId,
        attemptId: row.id,
        currentRevisionId: revisionId,
        archived: false,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert("goal_revisions", {
        id: revisionId,
        goalId,
        attemptId: row.id,
        input,
        archived: false,
        createdAt: now,
      });
    }

    for (const input of milestones) {
      const milestoneId = id(),
        revisionId = id();

      const { goalIndex, ...definition } = input;
      await tx.insert("milestones", {
        id: milestoneId,
        attemptId: row.id,
        currentRevisionId: revisionId,
        archived: false,
        locked: false,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert("milestone_revisions", {
        id: revisionId,
        milestoneId,
        attemptId: row.id,
        input: {
          ...definition,
          ...(goalIndex === undefined ? {} : { goalId: goalIds[goalIndex] }),
        },
        archived: false,
        createdAt: now,
      });
    }

    owner.currentAttemptId = row.id;
    owner.timezone = timezone;
    owner.participation = "active";
    owner.version++;
    owner.updatedAt = now;
    await claimSlot(tx, owner);
    await tx.save("enrollments", owner);
    return row;
  }

  return start;
}
