import type { TrackerCommand } from "@challenge/contracts";
import type { Transaction, User } from "../model.js";
import type { createTrackerAttempt } from "./attempt.js";
import type { createTrackerEnrollment } from "./enrollment.js";
import type { createTrackerReport } from "./report.js";
import { requireRule } from "./shared.js";

/** Build authorizeResult behavior using the owning service dependencies. */
export function createTrackerAuthorizeResult(context: {
  /** Shared service dependency. */ enrollment: ReturnType<
    typeof createTrackerEnrollment
  >;
  /** Shared service dependency. */ report: ReturnType<
    typeof createTrackerReport
  >;
  /** Shared service dependency. */ attempt: ReturnType<
    typeof createTrackerAttempt
  >;
}) {
  const { enrollment, report, attempt } = context;
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

  return authorizeResult;
}
