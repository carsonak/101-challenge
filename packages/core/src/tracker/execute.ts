import {
  trackerCommandSchema,
  type TrackerCommand,
} from "@challenge/contracts";
import type { Repository, Transaction, User } from "../model.js";
import { canonicalJson, digest } from "../rules.js";
import type { createTrackerActor } from "./actor.js";
import type { createTrackerAuthorizeResult } from "./authorizeResult.js";
import { requireRule } from "./shared.js";

/** Build execute behavior using the owning service dependencies. */
export function createTrackerExecute(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ actor: ReturnType<
    typeof createTrackerActor
  >;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ authorizeResult: ReturnType<
    typeof createTrackerAuthorizeResult
  >;
  /** Shared service dependency. */ dispatch: (
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ) => Promise<{ resourceId: string; version: number; rawKey?: string }>;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
}) {
  const { repository, actor, clock, authorizeResult, dispatch, id } = context;
  return {
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

        return { ...result, replayed: false };
      });
    },
  };
}
