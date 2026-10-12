import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import type { createTrackerActor } from "./actor.js";
import type { createTrackerAttempt } from "./attempt.js";
import { createTrackerBackdate } from "./backdate.js";
import type { createTrackerClaimSlot } from "./claimSlot.js";
import type { createTrackerEligibleDate } from "./eligibleDate.js";
import { createTrackerEnroll } from "./enroll.js";
import type { createTrackerEnrollment } from "./enrollment.js";
import { createTrackerGrantIssue } from "./grantIssue.js";
import { createTrackerGrantRevoke } from "./grantRevoke.js";
import type { createTrackerHasBackfill } from "./hasBackfill.js";
import { createTrackerLifecycle } from "./lifecycle.js";
import type { createTrackerReleaseSlot } from "./releaseSlot.js";
import type { createTrackerReorder } from "./reorder.js";
import type { createTrackerReport } from "./report.js";
import { createTrackerReportEdit } from "./reportEdit.js";
import { createTrackerReportSubmit } from "./reportSubmit.js";
import { createTrackerRevisions } from "./revisions.js";
import { createTrackerSeasonCreate } from "./seasonCreate.js";
import { createTrackerSeasonSave } from "./seasonSave.js";
import { requireRule } from "./shared.js";
import type { createTrackerStart } from "./start.js";
import type { createTrackerValidateValues } from "./validateValues.js";
/** Route a command within its existing actor transaction. */
export function createTrackerDispatch(context: {
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ secret: () => string;
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
  /** Shared service dependency. */ claimSlot: ReturnType<
    typeof createTrackerClaimSlot
  >;
  /** Shared service dependency. */ releaseSlot: ReturnType<
    typeof createTrackerReleaseSlot
  >;
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
  /** Shared service dependency. */ hasBackfill: ReturnType<
    typeof createTrackerHasBackfill
  >;
  /** Shared service dependency. */ eligibleDate: ReturnType<
    typeof createTrackerEligibleDate
  >;
  /** Shared service dependency. */ validateValues: ReturnType<
    typeof createTrackerValidateValues
  >;
  /** Shared service dependency. */ reorder: ReturnType<
    typeof createTrackerReorder
  >;
  /** Shared service dependency. */ report: ReturnType<
    typeof createTrackerReport
  >;
  /** Shared service dependency. */ clock: () => Date;
}) {
  const {
    id,
    secret,
    actor,
    defaultZone,
    enrollment,
    start,
    claimSlot,
    releaseSlot,
    attempt,
    hasBackfill,
    eligibleDate,
    validateValues,
    reorder,
    report,
    clock,
  } = context;

  const handlers = [
    createTrackerSeasonCreate({ id, secret }),
    createTrackerSeasonSave({}),
    createTrackerBackdate({
      actor,
      defaultZone,
      enrollment,
      start,
      id,
      secret,
      dispatch,
    }),
    createTrackerEnroll({ id, defaultZone, claimSlot }),
    createTrackerLifecycle({
      enrollment,
      defaultZone,
      start,
      id,
      releaseSlot,
      claimSlot,
    }),
    createTrackerReportSubmit({
      attempt,
      defaultZone,
      hasBackfill,
      eligibleDate,
      validateValues,
      id,
      releaseSlot,
      reorder,
    }),
    createTrackerReportEdit({
      report,
      hasBackfill,
      clock,
      eligibleDate,
      validateValues,
      reorder,
    }),
    createTrackerGrantIssue({ secret, id }),
    createTrackerGrantRevoke({}),
    createTrackerRevisions({ id, attempt, hasBackfill, reorder }),
  ];

  async function dispatch(
    tx: Transaction,
    user: User,
    c: TrackerCommand,
    now: string
  ): Promise<{ resourceId: string; version: number; rawKey?: string }> {
    for (const handler of handlers) {
      const result = await handler(tx, user, c, now);
      if (result) return result;
    }

    requireRule(false, "VALIDATION");
  }

  return dispatch;
}
