import type { ownerReportSchema } from "@challenge/contracts";
import type { GoalInput, MilestoneInput, Row, Timed } from "./common.js";

/** A goal's current revision pointer; archived goals and revisions remain readable. */
export interface Goal extends Timed {
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted current revision id for this record. */
  currentRevisionId: string;
  /** Persisted archived for this record. */
  archived: boolean;
}

/** Frozen definition; report references retain the definition applicable at save time. */
export interface GoalRevision extends Row {
  /** Persisted goal id for this record. */
  goalId: string;
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted input for this record. */
  input: GoalInput;
  /** Persisted archived for this record. */
  archived: boolean;
  /** Persisted created at for this record. */
  createdAt: string;
}

/** Milestone revision pointer with report-index lock. */
export interface Milestone extends Timed {
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted current revision id for this record. */
  currentRevisionId: string;
  /** Persisted archived for this record. */
  archived: boolean;
  /** Persisted locked for this record. */
  locked: boolean;
}

/** Frozen milestone definition and optional same-attempt goal association. */
export interface MilestoneRevision extends Row {
  /** Persisted milestone id for this record. */
  milestoneId: string;
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted input for this record. */
  input: Omit<MilestoneInput, "goalIndex"> & { goalId?: string };
  /** Persisted archived for this record. */
  archived: boolean;
  /** Persisted created at for this record. */
  createdAt: string;
}

/** Latest private report and frozen applicable facts; there is no log revision table. */
export type Report = ReturnType<typeof ownerReportSchema.parse> & {
  /** Persisted applicable goal revision ids for this record. */
  applicableGoalRevisionIds: string[];
  /** Persisted streak at report for this record. */
  streakAtReport: number;
  /** Persisted selected perks for this record. */
  selectedPerks: "streak_reroll"[];
  /** Persisted milestone facts for this record. */
  milestoneFacts: { revisionId: string; achieved: boolean }[];
};

/** Attempt-scoped credit with unique earning report; expiration happens on restart. */
export interface Credit extends Row {
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted earning report id for this record. */
  earningReportId: string;
  /** Persisted rule version for this record. */
  ruleVersion: number;
  /** Persisted expired for this record. */
  expired: boolean;
  /** Persisted created at for this record. */
  createdAt: string;
}

/** Permanent completion truth, separate from mutable attempt source. */
export interface Entitlement extends Row {
  /** Persisted enrollment id for this record. */
  enrollmentId: string;
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted completed at for this record. */
  completedAt: string;
  /** Persisted reporting dates for this record. */
  reportingDates: string[];
}

/** Resource/recipient-bound correction key hash and atomic use metadata. */
export interface Grant extends Row {
  /** Persisted user id for this record. */
  userId: string;
  /** Persisted attempt id for this record. */
  attemptId: string;
  /** Persisted report id for this record. */
  reportId: string | null;
  /** Persisted kind for this record. */
  kind: "single_report" | "attempt_window" | "backfill";
  /** Persisted token hash for this record. */
  tokenHash: string;
  /** Persisted expires at for this record. */
  expiresAt: string;
  /** Persisted used at for this record. */
  usedAt: string | null;
  /** Persisted revoked at for this record. */
  revokedAt: string | null;
  /** Persisted created at for this record. */
  createdAt: string;
}
