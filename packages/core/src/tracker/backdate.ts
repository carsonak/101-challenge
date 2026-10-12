import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { digest, reportingDate } from "../rules.js";
import type { createTrackerActor } from "./actor.js";
import type { createTrackerEnrollment } from "./enrollment.js";
import { requireRule } from "./shared.js";
import type { createTrackerStart } from "./start.js";

/** Build backdate behavior using the owning service dependencies. */
export function createTrackerBackdate(context: {
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ defaultZone: string;
  /** Shared service dependency. */ enrollment: ReturnType<
    typeof createTrackerEnrollment
  >;
  /** Shared service dependency. */ start: ReturnType<
    typeof createTrackerStart
  >;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ secret: () => string;
  /** Shared service dependency. */ dispatch: (
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) => Promise<{ resourceId: string; version: number; rawKey?: string }>;
}) {
  const { actor, defaultZone, enrollment, start, id, secret, dispatch } =
    context;

  async function backdate(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
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
  }

  return backdate;
}
