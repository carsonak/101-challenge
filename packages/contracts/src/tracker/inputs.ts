import { z } from "../validation.js";

/** UUID used for tracker resources; ownership is checked by core services. */
export const resourceId = z.uuid();

/** Optimistic version supplied by the caller for an existing resource. */
export const version = z.number().int().nonnegative();

/** Private text accepted only by owner-facing commands and projections. */
export const body = z.string().trim().min(1).max(4000);

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
export const goalValueSchema = z.strictObject({
  goalRevisionId: resourceId,
  value: decimalValueSchema,
});

/** Reject duplicate references before commands reach the transaction layer. */
export const goalValues = z
  .array(goalValueSchema)
  .max(20)
  .refine(
    (values) =>
      new Set(values.map((value) => value.goalRevisionId)).size ===
      values.length
  );

/** Validates an IANA timezone; core freezes it at the first attempt start. */
export const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return !/^[+-]/.test(value);
  } catch {
    return false;
  }
});
