import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import { reportingDate } from "../rules.js";
import type { createTrackerClaimSlot } from "./claimSlot.js";
import type { createTrackerEnrollment } from "./enrollment.js";
import type { createTrackerReleaseSlot } from "./releaseSlot.js";
import { requireRule } from "./shared.js";
import type { createTrackerStart } from "./start.js";

/** Build lifecycle behavior using the owning service dependencies. */
export function createTrackerLifecycle(context: {
  /** Shared service dependency. */ enrollment: ReturnType<
    typeof createTrackerEnrollment
  >;
  /** Shared service dependency. */ defaultZone: string;
  /** Shared service dependency. */ start: ReturnType<
    typeof createTrackerStart
  >;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ releaseSlot: ReturnType<
    typeof createTrackerReleaseSlot
  >;
  /** Shared service dependency. */ claimSlot: ReturnType<
    typeof createTrackerClaimSlot
  >;
}) {
  const { enrollment, defaultZone, start, id, releaseSlot, claimSlot } =
    context;

  async function lifecycle(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
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
  }

  return lifecycle;
}
