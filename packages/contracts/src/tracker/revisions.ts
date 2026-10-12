import { z } from "../validation.js";
import {
  initialGoalSchema,
  initialMilestoneSchema,
  resourceId,
  version,
} from "./inputs.js";

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
