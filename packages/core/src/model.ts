/** Compatibility facade for the existing public exports. */
export type { GoalInput, MilestoneInput, User } from "./model/common.js";

export type { Season, Enrollment, Slot, Attempt } from "./model/seasons.js";

export type {
  Goal,
  GoalRevision,
  Milestone,
  MilestoneRevision,
  Report,
  Credit,
  Entitlement,
  Grant,
} from "./model/practice.js";

export type { Replay, Outbox, Audit } from "./model/events.js";
export type { Tables, Transaction, Repository } from "./model/ports.js";

export type {
  Credential,
  Identity,
  Session,
  AuthToken,
  OAuthState,
  ErasureRequest,
  Profile,
  Notification,
  AccountMail,
} from "./model/accounts.js";
