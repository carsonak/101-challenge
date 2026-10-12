import { z } from "../validation.js";
import {
  initialGoalSchema,
  initialMilestoneSchema,
  resourceId,
  timezone,
  version,
} from "./inputs.js";

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
    timezone: timezone.optional(),
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

/** Shared setup inputs for an explicit retained-history restart. */
export const restartSetup = startAttemptSchema.shape;

/** Lifecycle mutations use the enrollment version; restart also binds the current attempt. */
export const enrollmentMutation = {
  enrollmentId: resourceId,
  expectedEnrollmentVersion: version,
};

/** Cancellation requires the season identifier; optionally erases current-attempt content. */
export const cancelEnrollmentSchema = z.strictObject({
  command: z.literal("CancelEnrollment"),
  ...enrollmentMutation,
  seasonSlug: z.string().min(1),
  erase: z.boolean().default(false),
});

/** Resumption reacquires a slot and continues a paused attempt without restoring benefits. */
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

/** Pause preserves progress but expires benefits and delays qualifying slot release. */
export const pauseEnrollmentSchema = z.strictObject({
  command: z.literal("PauseEnrollment"),
  ...enrollmentMutation,
});
