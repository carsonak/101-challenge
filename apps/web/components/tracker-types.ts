import type { createTracker } from "@challenge/core";
import type { accountSchema } from "@challenge/contracts";
/** Safe query types inferred from owner/admin service projections; all imports are type-only. */
export type History = Awaited<
  ReturnType<ReturnType<typeof createTracker>["history"]>
>;

/** One retained enrollment and its owned attempts. */
export type Enrollment = History[number];
/** One owned attempt and retained definition/report projections. */
export type Attempt = Enrollment["attempts"][number];
/** One deliberately published season template. */
export type Season = Awaited<
  ReturnType<ReturnType<typeof createTracker>["seasons"]>
>[number];

/** Metadata-only administrator statistics. */
export type Stats = Awaited<
  ReturnType<ReturnType<typeof createTracker>["adminStats"]>
>;

/** Owner-safe account settings, excluding proof and seed values. */
export type Account = ReturnType<typeof accountSchema.parse>;
