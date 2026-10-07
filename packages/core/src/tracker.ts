import { randomBytes, randomUUID } from "node:crypto";
import {
  trackerCommandSchema,
  progressSchema,
  enrollmentSchema,
  ownerReportSchema,
  adminReportSchema,
  seasonSchema,
  type TrackerCommand,
  type TrackerErrorCode,
} from "@challenge/contracts";
import { attemptSourceV1Schema } from "@challenge/contracts/source";
import type {
  Repository,
  Transaction,
  User,
  Enrollment,
  Attempt,
  Report,
  GoalInput,
  MilestoneInput,
  Grant,
} from "./model.js";
import {
  canonicalJson,
  digest,
  deriveAttemptSeed,
  reportingDate,
  streaks,
  activePerkTier,
} from "./rules.js";

/** Safe service failure code; messages never contain participant data. */
export class DomainError extends Error {
  /** Machine-readable code shared by both adapters. */
  readonly code: TrackerErrorCode;
  constructor(code: TrackerErrorCode) {
    super(code);
    this.name = "DomainError";
    this.code = code;
  }
}
/** Require an invariant without disclosing the rejected data. */
function requireRule(
  condition: unknown,
  code: TrackerErrorCode
): asserts condition {
  if (!condition) throw new DomainError(code);
}
/** Injected time and entropy make transactions deterministic under retries and tests. */
export interface TrackerOptions {
  /** Server-owned timezone for new participation. */
  timezone?: string;
  /** Clock resolved once per logical mutation. */
  now?: () => Date;
  /** UUID source for new resource identities. */
  id?: () => string;
  /** Private 32-byte entropy source, represented by lowercase hex. */
  secret?: () => string;
}
/** Read transaction records sequentially; one PostgreSQL connection owns the callback. */
async function mapInOrder<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = [];
  for (const value of values) result.push(await mapper(value));
  return result;
}

/** Framework-independent tracker; all mutations persist atomically through the repository. */
export function createTracker(
  repository: Repository,
  options: TrackerOptions = {}
) {
  const defaultZone = options.timezone ?? "Africa/Nairobi";
  const clock = options.now ?? (() => new Date());
  const id = options.id ?? randomUUID;
  const secret = options.secret ?? (() => randomBytes(32).toString("hex"));

  /** Load the authenticated user and serialize that user's mutations first. */
  async function actor(tx: Transaction, userId: string) {
    const user = await tx.get("users", userId, true);
    requireRule(user, "UNAUTHENTICATED");
    requireRule(
      !(await tx.list("erasure_requests", { userId, processedAt: null })).some(
        (r) => !r.cancelledAt
      ),
      "FORBIDDEN"
    );
    return user;
  }
  /** Lock an owned enrollment after its user. */
  async function enrollment(tx: Transaction, user: User, enrollmentId: string) {
    const row = await tx.get("enrollments", enrollmentId, true);
    requireRule(row && row.userId === user.id, "NOT_FOUND");
    return row;
  }
  /** Discover an attempt's parent without locking, then lock enrollment and attempt. */
  async function attempt(tx: Transaction, user: User, attemptId: string) {
    const found = await tx.get("attempts", attemptId);
    requireRule(found, "NOT_FOUND");
    const owner = await enrollment(tx, user, found.enrollmentId);
    const row = await tx.get("attempts", attemptId, true);
    requireRule(row, "NOT_FOUND");
    return { owner, row };
  }
  /** Serialize report mutation under its owner, enrollment and attempt locks. */
  async function report(tx: Transaction, user: User, reportId: string) {
    const found = await tx.get("reports", reportId);
    requireRule(found, "NOT_FOUND");
    const context = await attempt(tx, user, found.attemptId);
    const row = await tx.get("reports", reportId, true);
    requireRule(row, "NOT_FOUND");
    return { ...context, report: row };
  }
  /** Claim the one unfinished-season slot while holding the user lock. */
  async function claimSlot(tx: Transaction, row: Enrollment) {
    if (row.hasCompleted) return;
    let slot = await tx.get("slots", row.userId);
    if (slot && slot.enrollmentId !== row.id) {
      const held = await tx.get("enrollments", slot.enrollmentId, true);
      if (
        held?.participation === "paused" &&
        held.releaseOn &&
        held.releaseOn <= reportingDate(clock(), held.timezone ?? defaultZone)
      ) {
        await tx.remove("slots", row.userId);
        slot = undefined;
      }
    }
    requireRule(!slot || slot.enrollmentId === row.id, "SEASON_SLOT_OCCUPIED");
    if (!slot)
      await tx.insert("slots", { id: row.userId, enrollmentId: row.id });
  }
  /** Release only the slot held by this enrollment. */
  async function releaseSlot(tx: Transaction, row: Enrollment) {
    const slot = await tx.get("slots", row.userId);
    if (slot?.enrollmentId === row.id) await tx.remove("slots", row.userId);
  }
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
  /** Validate values against current revisions for submissions and retained applicable revisions for edits. */
  async function validateValues(
    tx: Transaction,
    row: Attempt,
    values: Report["goalValues"],
    prior?: Report
  ) {
    for (const value of values) {
      const revision = await tx.get("goal_revisions", value.goalRevisionId);
      requireRule(
        revision?.attemptId === row.id &&
          !revision.archived &&
          revision.input.kind !== "qualitative",
        "VALIDATION"
      );
      const goal = await tx.get("goals", revision.goalId);
      if (!prior)
        requireRule(
          goal && !goal.archived && goal.currentRevisionId === revision.id,
          "VALIDATION"
        );
      else {
        requireRule(
          prior.applicableGoalRevisionIds.includes(revision.id),
          "VALIDATION"
        );
      }
    }
  }
  /** Reauthorize safe replay references without returning cached private projections. */
  async function authorizeResult(
    tx: Transaction,
    user: User,
    command: TrackerCommand,
    resourceId: string
  ) {
    if (
      [
        "CreateSeason",
        "SaveSeason",
        "BackdateEnrollment",
        "PublishSeason",
        "SetSeasonFeatured",
        "SaveSeasonTemplate",
        "IssueCorrectionGrant",
        "RevokeCorrectionGrant",
      ].includes(command.command)
    ) {
      requireRule(user.admin, "FORBIDDEN");
      return;
    }
    if (
      [
        "Enroll",
        "CancelEnrollment",
        "PauseEnrollment",
        "ResumeEnrollment",
      ].includes(command.command)
    ) {
      await enrollment(tx, user, resourceId);
      return;
    }
    if (
      [
        "SubmitReport",
        "BackfillReport",
        "EditReport",
        "CorrectReport",
      ].includes(command.command)
    ) {
      await report(tx, user, resourceId);
      return;
    }
    await attempt(tx, user, resourceId);
  }
  /** A window can be revoked independently of its original fixed deadline. */
  async function hasBackfill(tx: Transaction, row: Attempt) {
    const now = clock().toISOString();
    return Boolean(
      row.backfillUntil &&
      row.backfillUntil > now &&
      (await tx.list("grants", { attemptId: row.id, kind: "backfill" })).some(
        (g) => !g.revokedAt && !g.usedAt && g.expiresAt > now
      )
    );
  }
  /** Historical edits respect both registration and first-publication local dates. */
  async function eligibleDate(
    tx: Transaction,
    owner: Enrollment,
    date: string,
    now: string
  ) {
    const season = await tx.get("seasons", owner.seasonId);
    requireRule(season?.publishedAt, "SEASON_UNAVAILABLE");
    const zone = owner.timezone ?? defaultZone;
    requireRule(
      date >= owner.registeredDate &&
        date >= reportingDate(new Date(season.publishedAt), zone) &&
        date <= reportingDate(new Date(now), zone),
      "VALIDATION"
    );
  }
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
  /** Dispatch a validated mutation inside its actor transaction. */
  async function dispatch(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ): Promise<{ resourceId: string; version: number; rawKey?: string }> {
    if (c.command === "CreateSeason") {
      requireRule(user.admin, "FORBIDDEN");
      await tx.serializeKey(`season-slug:${c.slug}`);
      requireRule(
        !(await tx.list("seasons", { slug: c.slug })).length,
        "VALIDATION"
      );
      const seasonId = id();
      await tx.insert("seasons", {
        id: seasonId,
        title: c.title,
        slug: c.slug,
        publishedAt: null,
        description: c.description ?? null,
        state: "draft",
        featured: false,
        seasonSeed: secret(),
        goals: [],
        milestones: [],
        sessionUrl: null,
        version: 0,
        createdAt: now,
        updatedAt: now,
      });
      return { resourceId: seasonId, version: 0 };
    }
    if (
      c.command === "SaveSeason" ||
      c.command === "PublishSeason" ||
      c.command === "SetSeasonFeatured" ||
      c.command === "SaveSeasonTemplate"
    ) {
      requireRule(user.admin, "FORBIDDEN");
      const row = await tx.get("seasons", c.seasonId, true);
      requireRule(row, "NOT_FOUND");
      requireRule(row.version === c.expectedSeasonVersion, "VERSION_CONFLICT");
      if (c.command === "SaveSeason") {
        requireRule(row.state === "draft" || row.slug === c.slug, "FORBIDDEN");
        requireRule(
          !c.publishedAt ||
            (!row.publishedAt &&
              row.state === "published" &&
              c.publishedAt <= now),
          "VALIDATION"
        );
        await tx.serializeKey(`season-slug:${c.slug}`);
        requireRule(
          !(await tx.list("seasons", { slug: c.slug })).some(
            (s) => s.id !== row.id
          ),
          "VALIDATION"
        );
        row.title = c.title;
        row.description = c.description;
        row.slug = c.slug;
        if (c.publishedAt) row.publishedAt = c.publishedAt;
      }
      if (c.command === "PublishSeason") {
        row.state = "published";
        row.publishedAt ??= now;
      }
      if (c.command === "SetSeasonFeatured") row.featured = c.featured;
      if (c.command === "SaveSeasonTemplate") {
        row.goals = c.goals;
        row.milestones = c.milestones;
        row.sessionUrl = c.sessionUrl ?? null;
      }
      row.version++;
      row.updatedAt = now;
      await tx.save("seasons", row);
      return { resourceId: row.id, version: row.version };
    }
    if (c.command === "BackdateEnrollment") {
      requireRule(user.admin, "FORBIDDEN");
      const target = await actor(tx, c.userId);
      const season = await tx.get("seasons", c.seasonId);
      requireRule(
        season?.state === "published" && season.publishedAt,
        "SEASON_UNAVAILABLE"
      );
      requireRule(
        c.registeredDate >=
          reportingDate(new Date(season.publishedAt), defaultZone) &&
          c.registeredDate <= reportingDate(new Date(now), defaultZone),
        "VALIDATION"
      );
      requireRule(
        !(
          await tx.list("enrollments", {
            userId: target.id,
            seasonId: season.id,
          })
        ).length,
        "VALIDATION"
      );
      requireRule(season.goals.length > 0, "VALIDATION");
      const result = await dispatch(
        tx,
        target,
        { command: "Enroll", seasonId: season.id },
        now
      );
      const owner = await enrollment(tx, target, result.resourceId);
      owner.registeredDate = c.registeredDate;
      const row = await start(
        tx,
        target,
        owner,
        defaultZone,
        season.goals,
        season.milestones,
        now
      );
      row.backfillUntil = new Date(Date.parse(now) + 86400000).toISOString();
      await tx.save("attempts", row);
      await tx.insert("grants", {
        id: id(),
        userId: target.id,
        attemptId: row.id,
        reportId: null,
        kind: "backfill",
        tokenHash: digest(secret()),
        expiresAt: row.backfillUntil,
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      });
      await tx.insert("notifications", {
        id: id(),
        userId: target.id,
        message:
          "Your backdated season is ready. Fill missing reports within 24 hours.",
        href: `/challenge/${owner.id}`,
        createdAt: now,
        readAt: null,
        dismissedAt: null,
      });
      return { resourceId: owner.id, version: owner.version };
    }
    if (c.command === "Enroll") {
      const season = await tx.get("seasons", c.seasonId);
      requireRule(season?.state === "published", "SEASON_UNAVAILABLE");
      const existing = (
        await tx.list("enrollments", { userId: user.id, seasonId: c.seasonId })
      )[0];
      if (existing)
        return { resourceId: existing.id, version: existing.version };
      const row: Enrollment = {
        id: id(),
        userId: user.id,
        seasonId: c.seasonId,
        participation: "active",
        timezone: null,
        registeredDate: reportingDate(new Date(now), defaultZone),
        releaseOn: null,
        currentAttemptId: null,
        hasCompleted: false,
        version: 0,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert("enrollments", row);
      await claimSlot(tx, row);
      return { resourceId: row.id, version: 0 };
    }
    if (
      c.command === "StartAttempt" ||
      c.command === "CancelEnrollment" ||
      c.command === "PauseEnrollment" ||
      c.command === "ResumeEnrollment" ||
      c.command === "RestartAttempt"
    ) {
      const owner = await enrollment(tx, user, c.enrollmentId);
      requireRule(
        owner.version === c.expectedEnrollmentVersion,
        "VERSION_CONFLICT"
      );
      const current = owner.currentAttemptId
        ? await tx.get("attempts", owner.currentAttemptId, true)
        : undefined;
      if (
        (c.command === "StartAttempt" || c.command === "RestartAttempt") &&
        c.timezone
      )
        requireRule(
          c.timezone === (owner.timezone ?? defaultZone),
          "VALIDATION"
        );
      if (c.command === "StartAttempt") {
        requireRule(
          owner.participation === "active" && !current,
          "ATTEMPT_CLOSED"
        );
        const row = await start(
          tx,
          user,
          owner,
          owner.timezone ?? defaultZone,
          c.goals,
          c.milestones,
          now
        );
        return { resourceId: row.id, version: row.version };
      }
      if (c.command === "RestartAttempt") {
        requireRule(
          current &&
            current.id === c.attemptId &&
            current.version === c.expectedAttemptVersion,
          "VERSION_CONFLICT"
        );
        requireRule(
          current.status === "active" ||
            current.status === "completed" ||
            current.status === "cancelled",
          "ATTEMPT_CLOSED"
        );
        if (current.status === "active") {
          current.status = "restarted";
          current.sourceVersion++;
          current.version++;
          current.updatedAt = now;
          await tx.save("attempts", current);
          await tx.insert("outbox", {
            id: id(),
            type: "source_changed",
            aggregateId: current.id,
            sourceVersion: current.sourceVersion,
            occurredAt: now,
            publishedAt: null,
            deliveries: 0,
          });
        }
        for (const credit of await tx.list("credits", {
          attemptId: current.id,
        })) {
          credit.expired = true;
          await tx.save("credits", credit);
        }
        const row = await start(
          tx,
          user,
          owner,
          owner.timezone ?? defaultZone,
          c.goals,
          c.milestones,
          now
        );
        return { resourceId: row.id, version: row.version };
      }
      if (c.command === "CancelEnrollment" || c.command === "PauseEnrollment") {
        requireRule(
          current &&
            (owner.participation === "active" ||
              (c.command === "CancelEnrollment" &&
                owner.participation === "paused")),
          "ATTEMPT_CLOSED"
        );
        if (c.command === "CancelEnrollment") {
          const season = await tx.get("seasons", owner.seasonId);
          requireRule(c.seasonSlug === season?.slug, "VALIDATION");
          owner.participation = "cancelled";
          current.status = "cancelled";
          await releaseSlot(tx, owner);
          owner.releaseOn = null;
        } else {
          owner.participation = "paused";
          current.status = "paused";
          const today = reportingDate(
            new Date(now),
            owner.timezone ?? defaultZone
          );
          owner.releaseOn = new Date(
            Date.parse(`${today}T00:00:00Z`) + 86400000
          )
            .toISOString()
            .slice(0, 10);
          current.pausedAt = now;
          const hasToday = (
            await tx.list("reports", { attemptId: current.id })
          ).some((r) => r.reportingDate === today);
          const cutoff = hasToday
            ? today
            : new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
                .toISOString()
                .slice(0, 10);
          current.streakAfter = cutoff;
          current.streakBreaks.push({ date: cutoff, at: now });
        }
        for (const grant of await tx.list("grants", {
          attemptId: current.id,
          kind: "backfill",
        })) {
          grant.revokedAt = now;
          await tx.save("grants", grant);
        }
        for (const credit of await tx.list("credits", {
          attemptId: current.id,
        })) {
          credit.expired = true;
          await tx.save("credits", credit);
        }
      } else {
        requireRule(owner.participation === "paused", "ATTEMPT_CLOSED");
        await claimSlot(tx, owner);
        owner.participation = "active";
        owner.releaseOn = null;
        if (current) {
          requireRule(current.status === "paused", "ATTEMPT_CLOSED");
          current.status = "active";
        }
      }
      owner.version++;
      owner.updatedAt = now;
      await tx.save("enrollments", owner);
      if (current) {
        current.sourceVersion++;
        current.version++;
        current.updatedAt = now;
        await tx.save("attempts", current);
        await tx.insert("outbox", {
          id: id(),
          type: "source_changed",
          aggregateId: current.id,
          sourceVersion: current.sourceVersion,
          occurredAt: now,
          publishedAt: null,
          deliveries: 0,
        });
      }
      if (c.command === "CancelEnrollment" && c.erase && current)
        await tx.eraseAttempt(user.id, current.id);
      return { resourceId: owner.id, version: owner.version };
    }
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
              reportingDate(new Date(now), owner.timezone ?? "UTC"),
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
    if (c.command === "IssueCorrectionGrant") {
      requireRule(user.admin, "FORBIDDEN");
      const saved =
        c.kind === "single_report"
          ? await tx.get("reports", c.reportId)
          : undefined;
      const target = await tx.get(
        "attempts",
        c.kind === "single_report" ? (saved?.attemptId ?? "") : c.attemptId
      );
      requireRule(target, "NOT_FOUND");
      const owner = await tx.get("enrollments", target.enrollmentId);
      requireRule(owner, "NOT_FOUND");
      const rawKey = secret();
      const grant: Grant = {
        id: id(),
        userId: owner.userId,
        attemptId: target.id,
        reportId: saved?.id ?? null,
        kind: c.kind,
        tokenHash: digest(rawKey),
        expiresAt: new Date(
          Date.parse(now) +
            (c.kind === "single_report" ? 86400000 : c.durationMinutes * 60000)
        ).toISOString(),
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      };
      await tx.insert("grants", grant);
      return { resourceId: grant.id, version: 0, rawKey };
    }
    if (c.command === "RevokeCorrectionGrant") {
      requireRule(user.admin, "FORBIDDEN");
      const grant = await tx.get("grants", c.grantId, true);
      requireRule(grant, "NOT_FOUND");
      grant.revokedAt = now;
      await tx.save("grants", grant);
      return { resourceId: grant.id, version: 0 };
    }
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
        requireRule(goal?.attemptId === row.id && !goal.archived, "NOT_FOUND");
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
        requireRule(goal?.attemptId === row.id && !goal.archived, "VALIDATION");
      }
      if (!milestone)
        requireRule(
          (await tx.list("milestones", { attemptId: row.id, archived: false }))
            .length < 101,
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

  return {
    /** Create an independent private account; authentication provisions usable sign-in methods separately. */
    async createUser(admin = false) {
      const now = clock().toISOString();
      const row: User = {
        id: id(),
        participantSeed: secret(),
        admin,
        createdAt: now,
        updatedAt: now,
      };
      await repository.transaction(async (tx) => {
        await tx.insert("users", row);
        await tx.insert("profiles", {
          id: row.id,
          username: `user-${row.id.replaceAll("-", "").slice(0, 26)}`,
          provisional: true,
          avatar: null,
          recoveryEmail: null,
          pendingEmail: null,
        });
      });
      return row.id;
    },
    /** Validate, authorize and execute an idempotent mutation; raw keys return only on initial issuance. */
    async execute(userId: string, input: unknown, key: string) {
      const parsed = trackerCommandSchema.safeParse(input);
      requireRule(
        parsed.success && key.length >= 1 && key.length <= 200,
        "VALIDATION"
      );
      const command = parsed.data;
      const requestHash = digest(canonicalJson(command));
      return repository.transaction(async (tx) => {
        const user = await actor(tx, userId);
        const now = clock().toISOString();
        const prior = (
          await tx.list("replays", { userId, command: command.command, key })
        )[0];
        if (prior && prior.expiresAt > now) {
          requireRule(
            prior.requestHash === requestHash,
            "IDEMPOTENCY_CONFLICT"
          );
          await authorizeResult(tx, user, command, prior.resourceId);
          return {
            resourceId: prior.resourceId,
            version: prior.version,
            replayed: true,
          };
        }
        if (prior) await tx.remove("replays", prior.id);
        const result = await dispatch(tx, user, command, now);
        await tx.insert("replays", {
          id: id(),
          userId,
          command: command.command,
          key,
          requestHash,
          resourceId: result.resourceId,
          version: result.version,
          expiresAt: new Date(Date.parse(now) + 30 * 86400000).toISOString(),
        });
        await tx.insert("audit", {
          id: id(),
          actorId: user.id,
          action: command.command,
          aggregateId: result.resourceId,
          occurredAt: now,
        });
        if (
          command.command !== "IssueCorrectionGrant" &&
          command.command !== "RevokeCorrectionGrant"
        ) {
          const changedReport = await tx.get("reports", result.resourceId);
          const changedAttempt = await tx.get(
            "attempts",
            changedReport?.attemptId ?? result.resourceId
          );
          const changedEnrollment = await tx.get(
            "enrollments",
            result.resourceId
          );
          await tx.insert("outbox", {
            id: id(),
            type: command.command.includes("Season")
              ? "season_changed"
              : changedAttempt
                ? "source_changed"
                : "enrollment_changed",
            aggregateId: changedAttempt?.id ?? result.resourceId,
            sourceVersion:
              changedAttempt?.sourceVersion ??
              changedEnrollment?.version ??
              result.version,
            occurredAt: now,
            publishedAt: null,
            deliveries: 0,
          });
        }
        if (
          !user.admin ||
          [
            "Enroll",
            "StartAttempt",
            "PauseEnrollment",
            "CancelEnrollment",
            "ResumeEnrollment",
            "RestartAttempt",
          ].includes(command.command)
        )
          await tx.insert("notifications", {
            id: id(),
            userId,
            message:
              (
                {
                  Enroll: "Season joined",
                  StartAttempt: "Challenge started",
                  PauseEnrollment: "Season paused",
                  CancelEnrollment: "Season cancelled",
                  ResumeEnrollment: "Season resumed",
                  RestartAttempt: "New attempt started",
                } as Record<string, string>
              )[command.command] ?? "Challenge progress updated",
            href: "/home",
            createdAt: now,
            readAt: null,
            dismissedAt: null,
          });
        return { ...result, replayed: false };
      });
    },
    /** List published seasons; administrators can separately request drafts. */
    async seasons(userId?: string, includeDrafts = false) {
      return repository.transaction(async (tx) => {
        if (includeDrafts) {
          requireRule(userId, "UNAUTHENTICATED");
          requireRule((await actor(tx, userId)).admin, "FORBIDDEN");
        }
        const rows = await tx.list(
          "seasons",
          includeDrafts ? {} : { state: "published" }
        );
        return rows.map((s) =>
          seasonSchema.parse({
            id: s.id,
            slug: s.slug,
            publishedAt: s.publishedAt,
            title: s.title,
            description: s.description,
            featured: s.featured,
            state: s.state,
            version: s.version,
            goals: s.goals,
            milestones: s.milestones,
            sessionUrl: s.sessionUrl,
          })
        );
      });
    },
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
                today: reportingDate(clock(), e.timezone ?? "UTC"),
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
