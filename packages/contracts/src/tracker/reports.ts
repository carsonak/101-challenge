import { z } from "../validation.js";
import { body, goalValues, resourceId, version } from "./inputs.js";

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

/** Owner corrects an existing report and eligible date using a key or an active backfill grant. */
export const correctReportSchema = editReportSchema.extend({
  command: z.literal("CorrectReport"),
  key: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  reportingDate: z.iso.date().optional(),
});

/** Owner fills a previously missing date only during their administrator-issued window. */
export const backfillReportSchema = submitReportSchema.extend({
  command: z.literal("BackfillReport"),
  reportingDate: z.iso.date(),
});
