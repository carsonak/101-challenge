import { z } from "zod";

/** UUID used for tracker resources; ownership is checked by core services. */
const resourceId = z.uuid();
/** Optimistic version supplied by the caller for an existing resource. */
const version = z.number().int().nonnegative();
/** Private text accepted only by owner-facing commands and projections. */
const body = z.string().trim().min(1).max(4000);
/** Decimal values with at most 18 total digits and six fractional digits. */
export const decimalValueSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d{1,6})?$/)
  .refine((value) => value.replace(".", "").length <= 18);
/** Initial custom goal; targets must be positive when supplied. */
export const initialGoalSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  kind: z.enum(["qualitative", "count", "duration", "quantity"]),
  unit: z.string().trim().min(1).max(40).optional(),
  target: decimalValueSchema.refine((value) => /[1-9]/.test(value)).optional(),
});
/** Optional initial milestone; a goal index refers to the submitted goal list. */
export const initialMilestoneSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  targetReportingDay: z.number().int().min(1).max(101),
  goalIndex: z.number().int().nonnegative().optional(),
  achievementKind: z.enum(["manual", "reporting_count"]),
});
/** A report value references a retained goal revision, never a mutable title. */
const goalValueSchema = z.strictObject({
  goalRevisionId: resourceId,
  value: decimalValueSchema,
});
/** Reject duplicate references before commands reach the transaction layer. */
const goalValues = z
  .array(goalValueSchema)
  .max(20)
  .refine(
    (values) =>
      new Set(values.map((value) => value.goalRevisionId)).size ===
      values.length
  );
/** Validates an IANA timezone; core freezes it at the first attempt start. */
const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return !/^[+-]/.test(value);
  } catch {
    return false;
  }
});
/** Enroll reserves a slot; authenticated identity comes from the adapter. */
export const enrollSchema = z.strictObject({
  command: z.literal("Enroll"),
  seasonId: resourceId,
});
/** Submit initial inputs atomically; timestamps, mode and seeds are server-owned. */
export const startAttemptSchema = z
  .strictObject({
    command: z.literal("StartAttempt"),
    enrollmentId: resourceId,
    expectedEnrollmentVersion: version,
    timezone,
    goals: z.array(initialGoalSchema).min(1).max(20),
    milestones: z.array(initialMilestoneSchema).max(101).default([]),
  })
  .refine(
    (input) =>
      input.milestones.every(
        (milestone) =>
          milestone.goalIndex === undefined ||
          milestone.goalIndex < input.goals.length
      ),
    { message: "Milestone goal index must reference an initial goal" }
  );
/** Submit today's report; core validates revision ownership and achievement targets. */
export const submitReportSchema = z.strictObject({
  command: z.literal("SubmitReport"),
  attemptId: resourceId,
  expectedAttemptVersion: version,
  body,
  goalValues,
  milestoneAchievements: z
    .array(resourceId)
    .max(101)
    .refine((ids) => new Set(ids).size === ids.length)
    .default([]),
});
/** Replace a same-day report, including the completion report until local midnight. */
export const editReportSchema = z.strictObject({
  command: z.literal("EditReport"),
  reportId: resourceId,
  expectedReportVersion: version,
  body,
  goalValues,
});
/** Shared setup inputs for an explicit retained-history restart. */
const restartSetup = startAttemptSchema.shape;
/** Lifecycle mutations use the enrollment version; restart also binds the current attempt. */
const enrollmentMutation = {
  enrollmentId: resourceId,
  expectedEnrollmentVersion: version,
};
/** Cancellation retains history and releases an unfinished-season slot. */
export const cancelEnrollmentSchema = z.strictObject({
  command: z.literal("CancelEnrollment"),
  ...enrollmentMutation,
});
/** Resumption reacquires a slot and continues the cancelled attempt. */
export const resumeEnrollmentSchema = z.strictObject({
  command: z.literal("ResumeEnrollment"),
  ...enrollmentMutation,
});
/** Restart submits new setup and explicit confirmation without deleting history. */
export const restartAttemptSchema = z
  .strictObject({
    ...restartSetup,
    command: z.literal("RestartAttempt"),
    attemptId: resourceId,
    expectedAttemptVersion: version,
    confirmed: z.literal(true),
  })
  .refine((input) =>
    input.milestones.every(
      (m) => m.goalIndex === undefined || m.goalIndex < input.goals.length
    )
  );
/** Save a new goal or a revision of an existing goal on an active attempt. */
export const saveGoalSchema = z.strictObject({
  command: z.literal("SaveGoal"),
  attemptId: resourceId,
  expectedAttemptVersion: version,
  goalId: resourceId.optional(),
  goal: initialGoalSchema,
});
/** Archive retains goal revisions and report references. */
export const archiveGoalSchema = z.strictObject({
  command: z.literal("ArchiveGoal"),
  attemptId: resourceId,
  expectedAttemptVersion: version,
  goalId: resourceId,
});
/** Save a future-target milestone; core checks same-attempt goal ownership. */
export const saveMilestoneSchema = z.strictObject({
  command: z.literal("SaveMilestone"),
  attemptId: resourceId,
  expectedAttemptVersion: version,
  milestoneId: resourceId.optional(),
  milestone: initialMilestoneSchema
    .omit({ goalIndex: true })
    .extend({ goalId: resourceId.optional() }),
});
/** Archive a future milestone without removing its revisions. */
export const archiveMilestoneSchema = z.strictObject({
  command: z.literal("ArchiveMilestone"),
  attemptId: resourceId,
  expectedAttemptVersion: version,
  milestoneId: resourceId,
});
/** Admin issues either a 24-hour single-report key or an at-most-one-hour window. */
export const issueCorrectionGrantSchema = z.union([
  z.strictObject({
    command: z.literal("IssueCorrectionGrant"),
    kind: z.literal("single_report"),
    reportId: resourceId,
  }),
  z.strictObject({
    command: z.literal("IssueCorrectionGrant"),
    kind: z.literal("attempt_window"),
    attemptId: resourceId,
    durationMinutes: z.number().int().min(1).max(60),
  }),
]);
/** Revoke a correction grant by safe identifier, never by raw key. */
export const revokeCorrectionGrantSchema = z.strictObject({
  command: z.literal("RevokeCorrectionGrant"),
  grantId: resourceId,
});
/** Owner redeems a secret key to overwrite an existing report; no date can be supplied. */
export const correctReportSchema = editReportSchema.extend({
  command: z.literal("CorrectReport"),
  key: z.string().regex(/^[a-f0-9]{64}$/),
});
/** Admin creates a draft; publishing and featuring are separate explicit actions. */
export const createSeasonSchema = z.strictObject({
  command: z.literal("CreateSeason"),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
});
/** Publish never imposes an enrollment deadline. */
export const publishSeasonSchema = z.strictObject({
  command: z.literal("PublishSeason"),
  seasonId: resourceId,
  expectedSeasonVersion: version,
});
/** Featured status affects discovery alone. */
export const setSeasonFeaturedSchema = z.strictObject({
  command: z.literal("SetSeasonFeatured"),
  seasonId: resourceId,
  expectedSeasonVersion: version,
  featured: z.boolean(),
});
/** Recommended setup is optional; custom participant setup is equally valid. */
export const saveSeasonTemplateSchema = z
  .strictObject({
    command: z.literal("SaveSeasonTemplate"),
    seasonId: resourceId,
    expectedSeasonVersion: version,
    goals: z.array(initialGoalSchema).max(20),
    milestones: z.array(initialMilestoneSchema).max(101),
    sessionUrl: z
      .url()
      .refine((url) => /^https?:\/\//.test(url))
      .optional(),
  })
  .refine((input) =>
    input.milestones.every(
      (m) => m.goalIndex === undefined || m.goalIndex < input.goals.length
    )
  );
/** Complete v0.1 domain command registry; authentication has separate contracts. */
export const trackerCommandSchema = z.union([
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
/** Safe metadata-only progress; pass an explicit projection, not a database entity. */
export const progressSchema = z.strictObject({
  enrollmentId: resourceId,
  attemptId: resourceId,
  participation: z.enum(["active", "cancelled", "completed"]),
  attemptState: z.enum(["active", "cancelled", "restarted", "completed"]),
  mode: z.enum(["qualifying", "progress_only"]),
  reportingDays: z.number().int().min(0).max(101),
  currentStreak: z.number().int().min(0).max(101),
  longestStreak: z.number().int().min(0).max(101),
  rerollCredits: z.number().int().nonnegative(),
  version,
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

/** Owner-visible report; never use this projection for administrators. */
export const ownerReportSchema = z.strictObject({
  id: resourceId,
  attemptId: resourceId,
  reportingDate: z.iso.date(),
  reportingIndex: z.number().int().min(1).max(101),
  body,
  goalValues,
  /** Revision identifiers frozen when this reporting day was accepted. */
  applicableGoalRevisionIds: z.array(resourceId).max(20).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version,
});
/** Owner-safe seasonal enrollment including setup and current slot state. */
export const enrollmentSchema = z.strictObject({
  id: resourceId,
  seasonId: resourceId,
  participation: z.enum(["active", "cancelled", "completed"]),
  timezone: z.string().nullable(),
  currentAttemptId: resourceId.nullable(),
  hasCompleted: z.boolean(),
  version,
});
/** Public season discovery contains only deliberately published template text. */
export const seasonSchema = z.strictObject({
  id: resourceId,
  title: z.string(),
  description: z.string().nullable(),
  featured: z.boolean(),
  state: z.enum(["draft", "published"]),
  version,
  goals: z.array(initialGoalSchema),
  milestones: z.array(initialMilestoneSchema),
  sessionUrl: z.string().nullable(),
});
/** Stable cursor requests are bounded; cursor content remains opaque to clients. */
export const pageRequestSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1000).optional(),
});
/** Administrator report metadata intentionally excludes text and goal values. */
export const adminReportSchema = ownerReportSchema.omit({
  body: true,
  goalValues: true,
});
