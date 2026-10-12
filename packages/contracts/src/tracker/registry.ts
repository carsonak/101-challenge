import { z } from "../validation.js";
import { resourceId, version } from "./inputs.js";
import {
  cancelEnrollmentSchema,
  enrollSchema,
  pauseEnrollmentSchema,
  restartAttemptSchema,
  resumeEnrollmentSchema,
  startAttemptSchema,
} from "./lifecycle.js";
import {
  backfillReportSchema,
  correctReportSchema,
  editReportSchema,
  issueCorrectionGrantSchema,
  revokeCorrectionGrantSchema,
  submitReportSchema,
} from "./reports.js";
import {
  archiveGoalSchema,
  archiveMilestoneSchema,
  saveGoalSchema,
  saveMilestoneSchema,
} from "./revisions.js";
import {
  backdateEnrollmentSchema,
  createSeasonSchema,
  publishSeasonSchema,
  saveSeasonSchema,
  saveSeasonTemplateSchema,
  setSeasonFeaturedSchema,
} from "./seasons.js";

/** Complete v0.1 domain command registry; authentication has separate contracts. */
export const trackerCommandSchema = z.union([
  pauseEnrollmentSchema,
  saveSeasonSchema,
  backdateEnrollmentSchema,
  backfillReportSchema,
  enrollSchema,
  startAttemptSchema,
  submitReportSchema,
  editReportSchema,
  cancelEnrollmentSchema,
  resumeEnrollmentSchema,
  restartAttemptSchema,
  saveGoalSchema,
  archiveGoalSchema,
  saveMilestoneSchema,
  archiveMilestoneSchema,
  issueCorrectionGrantSchema,
  revokeCorrectionGrantSchema,
  correctReportSchema,
  createSeasonSchema,
  publishSeasonSchema,
  setSeasonFeaturedSchema,
  saveSeasonTemplateSchema,
]);

/** Validated command input shared by browser and Discord adapters. */
export type TrackerCommand = z.infer<typeof trackerCommandSchema>;

/** Successful mutation refers to a resource; replays reload and reauthorize that resource. */
export const commandResultSchema = z.strictObject({
  resourceId,
  version,
  replayed: z.boolean(),
});

/** Metadata-only event for durable outbox delivery; workers reload authorized state. */
export const trackerEventSchema = z.strictObject({
  eventId: resourceId,
  type: z.enum(["source_changed", "enrollment_changed", "season_changed"]),
  schemaVersion: z.literal(1),
  aggregateId: resourceId,
  sourceVersion: version,
  occurredAt: z.iso.datetime(),
});

/** Public error codes; messages and validation details must not echo private inputs. */
export const trackerErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "VERSION_CONFLICT",
  "ALREADY_REPORTED",
  "ATTEMPT_CLOSED",
  "SEASON_UNAVAILABLE",
  "SEASON_SLOT_OCCUPIED",
  "MILESTONE_LOCKED",
  "GRANT_INVALID",
  "RATE_LIMITED",
  "IDEMPOTENCY_CONFLICT",
]);

/** Typed failure code for service and adapter error mapping. */
export type TrackerErrorCode = z.infer<typeof trackerErrorCodeSchema>;
