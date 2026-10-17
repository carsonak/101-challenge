import type { TrackerCommand } from "@challenge/contracts";
import type { Grant, Transaction, User } from "../model.js";
import { digest } from "../rules.js";
import { requireRule } from "./shared.js";

/** Build grantIssue behavior using the owning service dependencies. */
export function createTrackerGrantIssue(context: {
  /** Shared service dependency. */ secret: () => string;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
}) {
  const { secret, id } = context;
  async function grantIssue(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) {
    if (c.command === "IssueCorrectionGrant") {
      requireRule(user.admin, "FORBIDDEN");
      const saved =
        c.kind === "single_report"
          ? await tx.get("reports", c.reportId)
          : undefined;

      if (c.kind === "single_report") requireRule(saved, "NOT_FOUND");

      const target = await tx.get(
        "attempts",
        c.kind === "single_report" ? (saved?.attemptId ?? "") : c.attemptId
      );

      requireRule(target, "NOT_FOUND");
      requireRule(!target.erased, "ATTEMPT_CLOSED");
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
  }

  return grantIssue;
}
