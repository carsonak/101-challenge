import { z } from "../validation.js";
import {
  initialGoalSchema,
  initialMilestoneSchema,
  resourceId,
  version,
} from "./inputs.js";

/** Admin creates a draft; publishing and featuring are separate explicit actions. */
export const createSeasonSchema = z.strictObject({
  command: z.literal("CreateSeason"),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
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

/** Versioned administrator metadata changes; identifiers freeze at publication. */
export const saveSeasonSchema = z.strictObject({
  command: z.literal("SaveSeason"),
  seasonId: resourceId,
  expectedSeasonVersion: version,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  publishedAt: z.iso.datetime().optional(),
});

/** Administrator creates template participation with a fixed 24-hour owner backfill. */
export const backdateEnrollmentSchema = z.strictObject({
  command: z.literal("BackdateEnrollment"),
  userId: resourceId,
  seasonId: resourceId,
  registeredDate: z.iso.date(),
});
