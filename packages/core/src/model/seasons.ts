import type { GoalInput, MilestoneInput, Row, Timed } from "./common.js";

/** Season stores private entropy and public optional setup recommendations separately. */
export interface Season extends Timed {
  /** Persisted title for this record. */
  title: string;
  /** Stable public URL identifier; frozen on publication. */
  slug: string;
  /** First publication instant; legacy unknown values require explicit reconciliation. */
  publishedAt: string | null;
  /** Persisted description for this record. */
  description: string | null;
  /** Persisted state for this record. */
  state: "draft" | "published";
  /** Persisted featured for this record. */
  featured: boolean;
  /** Persisted season seed for this record. */
  seasonSeed: string;
  /** Persisted goals for this record. */
  goals: GoalInput[];
  /** Persisted milestones for this record. */
  milestones: MilestoneInput[];
  /** Persisted session url for this record. */
  sessionUrl: string | null;
  /** Persisted version for this record. */
  version: number;
}

/** Retained per-season participation, independent of any current attempt. */
export interface Enrollment extends Timed {
  /** Earliest eligible local reporting date; actual creation remains separately retained. */
  registeredDate: string;
  /** Date before which another qualifying enrollment cannot claim the slot. */
  releaseOn: string | null;
  /** Persisted user id for this record. */
  userId: string;
  /** Persisted season id for this record. */
  seasonId: string;
  /** Persisted participation for this record. */
  participation: "active" | "paused" | "cancelled" | "completed";
  /** Persisted timezone for this record. */
  timezone: string | null;
  /** Persisted current attempt id for this record. */
  currentAttemptId: string | null;
  /** Persisted has completed for this record. */
  hasCompleted: boolean;
  /** Persisted version for this record. */
  version: number;
}

/** The user's one unfinished-season slot; its ID is the user ID. */
export interface Slot extends Row {
  /** Persisted enrollment id for this record. */
  enrollmentId: string;
}

/** Private retained attempt; seed inputs freeze at setup and can only be removed by explicit erasure. */
export interface Attempt extends Timed {
  /** Retained pause boundaries for chronological streak recalculation. */
  streakBreaks: { date: string; at: string }[];
  /** Last pause instant; reports saved before this never earn new post-pause credits. */
  pausedAt: string | null;
  /** Last local date excluded from a new post-pause streak. */
  streakAfter: string | null;
  /** Fixed administrator backfill deadline. */
  backfillUntil: string | null;
  /** Whether private attempt content was explicitly erased on cancellation. */
  erased: boolean;
  /** Persisted enrollment id for this record. */
  enrollmentId: string;
  /** Persisted sequence for this record. */
  sequence: number;
  /** Persisted status for this record. */
  status: "active" | "paused" | "cancelled" | "restarted" | "completed";
  /** Persisted mode for this record. */
  mode: "qualifying" | "progress_only";
  /** Persisted base seed for this record. */
  baseSeed: string;
  /** Persisted seed version for this record. */
  seedVersion: "attempt-v1";
  /** Persisted initial input digest for this record. */
  initialInputDigest: string;
  /** Persisted initial goals for this record. */
  initialGoals: GoalInput[];
  /** Persisted initial milestones for this record. */
  initialMilestones: MilestoneInput[];
  /** Persisted started at for this record. */
  startedAt: string;
  /** Persisted source version for this record. */
  sourceVersion: number;
  /** Persisted version for this record. */
  version: number;
}
