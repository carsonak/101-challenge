import { z } from "zod";
import {
  initialGoalSchema,
  initialMilestoneSchema,
  ownerReportSchema,
} from "./tracker.js";

/** Private lowercase 32-byte entropy; this module must remain server-only. */
const seed = z.string().regex(/^[a-f0-9]{64}$/);
/** Private versioned report facts supporting future deterministic backfill. */
const reportSource = ownerReportSchema.extend({
  applicableGoalRevisionIds: z.array(z.uuid()).max(20),
  goalRevisionFacts: z.array(
    z.strictObject({ revisionId: z.uuid(), input: initialGoalSchema })
  ),
  streakAtReport: z.number().int().min(0).max(101),
  selectedPerks: z.array(z.literal("streak_reroll")),
  milestoneFacts: z.array(
    z.strictObject({
      revisionId: z.uuid(),
      achieved: z.boolean(),
      input: initialMilestoneSchema
        .omit({ goalIndex: true })
        .extend({ goalId: z.uuid().optional() }),
    })
  ),
});
/** Server-only source projection, read consistently and reauthorized for each use. */
export const attemptSourceV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  userId: z.uuid(),
  enrollmentId: z.uuid(),
  seasonId: z.uuid(),
  attemptId: z.uuid(),
  attemptMode: z.enum(["qualifying", "progress_only"]),
  status: z.enum(["active", "paused", "cancelled", "restarted", "completed"]),
  timezone: z.string(),
  startedAt: z.iso.datetime(),
  baseSeed: seed,
  seedVersion: z.literal("attempt-v1"),
  sourceVersion: z.number().int().nonnegative(),
  initialGoals: z.array(initialGoalSchema).min(1).max(20),
  initialMilestones: z.array(initialMilestoneSchema).max(101),
  reports: z.array(reportSource).max(101),
  completion: z
    .strictObject({
      entitlementId: z.uuid(),
      completedAttemptId: z.uuid(),
      completedAt: z.iso.datetime(),
      reportingDates: z.array(z.iso.date()).length(101),
    })
    .nullable(),
});
/** Private source type; never return it through owner, admin or public HTTP routes. */
export type AttemptSourceV1 = z.infer<typeof attemptSourceV1Schema>;
