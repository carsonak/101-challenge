import { z } from "../validation.js";
import {
  body,
  goalValues,
  initialGoalSchema,
  initialMilestoneSchema,
  resourceId,
  version,
} from "./inputs.js";

/** Safe metadata-only progress; pass an explicit projection, not a database entity. */
export const progressSchema = z.strictObject({
  enrollmentId: resourceId,
  attemptId: resourceId,
  participation: z.enum(["active", "paused", "cancelled", "completed"]),
  attemptState: z.enum([
    "active",
    "paused",
    "cancelled",
    "restarted",
    "completed",
  ]),
  mode: z.enum(["qualifying", "progress_only"]),
  reportingDays: z.number().int().min(0).max(101),
  currentStreak: z.number().int().min(0).max(101),
  longestStreak: z.number().int().min(0).max(101),
  // TODO(artwork): Document the selected tier benefits when the artwork release contract is accepted.
  /** Streak tier is separate from the credit balance; concrete benefits ship with artwork. */
  perkTier: z.number().int().nonnegative().default(0),
  rerollCredits: z.number().int().nonnegative(),
  version,
});

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
  registeredDate: z.iso.date(),
  releaseOn: z.iso.date().nullable(),
  id: resourceId,
  seasonId: resourceId,
  participation: z.enum(["active", "paused", "cancelled", "completed"]),
  timezone: z.string().nullable(),
  currentAttemptId: resourceId.nullable(),
  hasCompleted: z.boolean(),
  version,
});

/** Public season discovery contains only deliberately published template text. */
export const seasonSchema = z.strictObject({
  slug: z.string(),
  publishedAt: z.iso.datetime().nullable(),
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
