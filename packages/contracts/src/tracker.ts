/** Compatibility facade for the existing public exports. */
export {
  decimalValueSchema,
  initialGoalSchema,
  initialMilestoneSchema,
} from "./tracker/inputs.js";

export {
  enrollSchema,
  startAttemptSchema,
  cancelEnrollmentSchema,
  resumeEnrollmentSchema,
  restartAttemptSchema,
  pauseEnrollmentSchema,
} from "./tracker/lifecycle.js";

export {
  submitReportSchema,
  editReportSchema,
  issueCorrectionGrantSchema,
  revokeCorrectionGrantSchema,
  correctReportSchema,
  backfillReportSchema,
} from "./tracker/reports.js";

export {
  saveGoalSchema,
  archiveGoalSchema,
  saveMilestoneSchema,
  archiveMilestoneSchema,
} from "./tracker/revisions.js";

export {
  createSeasonSchema,
  publishSeasonSchema,
  setSeasonFeaturedSchema,
  saveSeasonTemplateSchema,
  saveSeasonSchema,
  backdateEnrollmentSchema,
} from "./tracker/seasons.js";

export {
  trackerCommandSchema,
  type TrackerCommand,
  commandResultSchema,
  trackerEventSchema,
  trackerErrorCodeSchema,
  type TrackerErrorCode,
} from "./tracker/registry.js";

export {
  progressSchema,
  ownerReportSchema,
  enrollmentSchema,
  seasonSchema,
  pageRequestSchema,
  adminReportSchema,
} from "./tracker/projections.js";
