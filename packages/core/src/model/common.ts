import type {
  initialGoalSchema,
  initialMilestoneSchema,
} from "@challenge/contracts";

/** Validated goal definition retained by explicit revision saves. */
export type GoalInput = ReturnType<typeof initialGoalSchema.parse>;

/** Validated initial milestone with an optional ordered initial-goal reference. */
export type MilestoneInput = ReturnType<typeof initialMilestoneSchema.parse>;

/** Common resource identity for repository records. */
export interface Row {
  /** Persisted id for this record. */
  id: string;
}

/** Common creation/update instants, stored as UTC ISO strings. */
export interface Timed extends Row {
  /** Persisted created at for this record. */
  createdAt: string;
  /** Persisted updated at for this record. */
  updatedAt: string;
}

/** Private persisted user; transport code must explicitly project safe fields. */
export interface User extends Timed {
  /** Persisted participant seed for this record. */
  participantSeed: string;
  /** Persisted admin for this record. */
  admin: boolean;
}
