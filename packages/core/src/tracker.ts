import { randomBytes, randomUUID } from "node:crypto";
import type { Repository } from "./model.js";
import { createTrackerActor } from "./tracker/actor.js";
import { createTrackerAdminStats } from "./tracker/adminStats.js";
import { createTrackerAttempt } from "./tracker/attempt.js";
import { createTrackerAuthorizeResult } from "./tracker/authorizeResult.js";
import { createTrackerClaimSlot } from "./tracker/claimSlot.js";
import { createTrackerCreateUser } from "./tracker/createUser.js";
import { createTrackerDailySummary } from "./tracker/dailySummary.js";
import { createTrackerDispatch } from "./tracker/dispatch.js";
import { createTrackerEligibleDate } from "./tracker/eligibleDate.js";
import { createTrackerEnrollment } from "./tracker/enrollment.js";
import { createTrackerExecute } from "./tracker/execute.js";
import { createTrackerHasBackfill } from "./tracker/hasBackfill.js";
import { createTrackerHistory } from "./tracker/history.js";
import { createTrackerReleaseSlot } from "./tracker/releaseSlot.js";
import { createTrackerReorder } from "./tracker/reorder.js";
import { createTrackerReport } from "./tracker/report.js";
import { createTrackerSeasons } from "./tracker/seasons.js";
import type { TrackerOptions } from "./tracker/shared.js";
import { createTrackerSource } from "./tracker/source.js";
import { createTrackerStart } from "./tracker/start.js";
import { createTrackerValidateValues } from "./tracker/validateValues.js";
export { DomainError, type TrackerOptions } from "./tracker/shared.js";
/** Framework-independent tracker; all mutations persist atomically through the repository. */
export function createTracker(
  repository: Repository,
  options: TrackerOptions = {}
) {
  const defaultZone = options.timezone ?? "Africa/Nairobi";
  const clock = options.now ?? (() => new Date());
  const id = options.id ?? randomUUID;
  const secret = options.secret ?? (() => randomBytes(32).toString("hex"));
  const actor = createTrackerActor({});
  const enrollment = createTrackerEnrollment({});
  const attempt = createTrackerAttempt({ enrollment });
  const report = createTrackerReport({ attempt });
  const claimSlot = createTrackerClaimSlot({ clock, defaultZone });
  const releaseSlot = createTrackerReleaseSlot({});
  const start = createTrackerStart({ id, claimSlot });
  const validateValues = createTrackerValidateValues({});
  const authorizeResult = createTrackerAuthorizeResult({
    enrollment,
    report,
    attempt,
  });

  const hasBackfill = createTrackerHasBackfill({ clock });
  const eligibleDate = createTrackerEligibleDate({ defaultZone });
  const reorder = createTrackerReorder({ id });
  const dispatch = createTrackerDispatch({
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
  });

  return {
    ...createTrackerCreateUser({ clock, id, secret, repository }),
    ...createTrackerExecute({
      repository,
      actor,
      clock,
      authorizeResult,
      dispatch,
      id,
    }),
    ...createTrackerSeasons({ repository, actor }),
    ...createTrackerDailySummary({ repository, actor, clock, defaultZone }),
    ...createTrackerHistory({
      repository,
      actor,
      defaultZone,
      clock,
      hasBackfill,
    }),
    ...createTrackerAdminStats({ repository, actor, clock, defaultZone }),
    ...createTrackerSource({ repository, actor, attempt }),
  };
}
