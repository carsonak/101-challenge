import type {
  initialGoalSchema,
  initialMilestoneSchema,
  ownerReportSchema,
} from "@challenge/contracts";

/** Validated goal definition retained by explicit revision saves. */
export type GoalInput = ReturnType<typeof initialGoalSchema.parse>;
/** Validated initial milestone with an optional ordered initial-goal reference. */
export type MilestoneInput = ReturnType<typeof initialMilestoneSchema.parse>;
/** Common resource identity for repository records. */
interface Row {
  /** Persisted id for this record. */
  id: string;
}
/** Common creation/update instants, stored as UTC ISO strings. */
interface Timed extends Row {
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
/** Season stores private entropy and public optional setup recommendations separately. */
export interface Season extends Timed {
  /** Persisted title for this record. */
  title: string;
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
  /** Persisted user id for this record. */
  userId: string;
  /** Persisted season id for this record. */
  seasonId: string;
  /** Persisted participation for this record. */
  participation: "active" | "cancelled" | "completed";
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
/** Private retained attempt; initial inputs never change after setup. */
export interface Attempt extends Timed {
  /** Persisted enrollment id for this record. */
  enrollmentId: string;
  /** Persisted sequence for this record. */
  sequence: number;
  /** Persisted status for this record. */
  status: "active" | "cancelled" | "restarted" | "completed";
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
  kind: "single_report" | "attempt_window";
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
/** Private-payload digest and safe replay reference; never contains command text. */
export interface Replay extends Row {
  /** Persisted user id for this record. */
  userId: string;
  /** Persisted command for this record. */
  command: string;
  /** Persisted key for this record. */
  key: string;
  /** Persisted request hash for this record. */
  requestHash: string;
  /** Persisted resource id for this record. */
  resourceId: string;
  /** Persisted version for this record. */
  version: number;
  /** Persisted expires at for this record. */
  expiresAt: string;
}
/** Content-free event delivery state. */
export interface Outbox extends Row {
  /** Persisted type for this record. */
  type: "source_changed" | "enrollment_changed" | "season_changed";
  /** Persisted aggregate id for this record. */
  aggregateId: string;
  /** Persisted source version for this record. */
  sourceVersion: number;
  /** Persisted occurred at for this record. */
  occurredAt: string;
  /** Persisted published at for this record. */
  publishedAt: string | null;
  /** Persisted deliveries for this record. */
  deliveries: number;
  /** Worker lease expiry; absent on freshly inserted domain events. */
  leasedUntil?: string | null;
  /** Safe failure timestamp without exception content. */
  lastFailureAt?: string | null;
}
/** Content-free audit record. */
export interface Audit extends Row {
  /** Persisted actor id for this record. */
  actorId: string;
  /** Persisted action for this record. */
  action: string;
  /** Persisted aggregate id for this record. */
  aggregateId: string;
  /** Persisted occurred at for this record. */
  occurredAt: string;
}
/** Typed repository tables; private records remain behind services. */
export interface Tables {
  /** Persisted users for this record. */
  users: User;
  /** Persisted seasons for this record. */
  seasons: Season;
  /** Persisted enrollments for this record. */
  enrollments: Enrollment;
  /** Persisted slots for this record. */
  slots: Slot;
  /** Persisted attempts for this record. */
  attempts: Attempt;
  /** Persisted goals for this record. */
  goals: Goal;
  /** Persisted goal_revisions for this record. */
  goal_revisions: GoalRevision;
  /** Persisted milestones for this record. */
  milestones: Milestone;
  /** Persisted milestone_revisions for this record. */
  milestone_revisions: MilestoneRevision;
  /** Persisted reports for this record. */
  reports: Report;
  /** Persisted credits for this record. */
  credits: Credit;
  /** Persisted entitlements for this record. */
  entitlements: Entitlement;
  /** Persisted grants for this record. */
  grants: Grant;
  /** Persisted replays for this record. */
  replays: Replay;
  /** Persisted outbox for this record. */
  outbox: Outbox;
  /** Persisted audit for this record. */
  audit: Audit;
  /** Private credentials records for authentication/privacy services. */
  credentials: Credential;
  /** Private identities records for authentication/privacy services. */
  identities: Identity;
  /** Private sessions records for authentication/privacy services. */
  sessions: Session;
  /** Private auth tokens records for authentication/privacy services. */
  auth_tokens: AuthToken;
  /** Private oauth states records for authentication/privacy services. */
  oauth_states: OAuthState;
  /** Private erasure requests records for authentication/privacy services. */
  erasure_requests: ErasureRequest;
}
/** Repository transaction port; implementations own persistence, SQL and rollback. */
export interface Transaction {
  /** Load and optionally lock one row; callers follow user/enrollment/attempt lock order. */
  get<K extends keyof Tables>(
    table: K,
    id: string,
    lock?: boolean
  ): Promise<Tables[K] | undefined>;
  /** Read matching rows in stable ID order; caller must authorize the owner. */
  list<K extends keyof Tables>(
    table: K,
    where: Partial<Tables[K]>
  ): Promise<Tables[K][]>;
  /** Insert a new record; constraints reject duplicate or cross-resource references. */
  insert<K extends keyof Tables>(table: K, row: Tables[K]): Promise<void>;
  /** Replace a mutable record already locked by the domain service. */
  save<K extends keyof Tables>(table: K, row: Tables[K]): Promise<void>;
  /** Remove only ephemeral slots or expired replay records during domain operations. */
  remove(
    table:
      | "slots"
      | "replays"
      | "credentials"
      | "identities"
      | "sessions"
      | "auth_tokens"
      | "oauth_states",
    id: string
  ): Promise<void>;
  /** Serialize provisioning by normalized identity key without taking another user lock. */
  serializeKey(key: string): Promise<void>;
}
/** Database transaction owner; every rejected callback rolls back all writes. */
export interface Repository {
  /** Execute a callback atomically, retrying serialization/deadlock failures with bounded attempts. */
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
}

/** Private email credential; ID equals user ID and address uniqueness is database-enforced. */
export interface Credential extends Row {
  /** Account owning this independently verified sign-in method. */
  userId: string;
  /** Normalized private delivery/sign-in address. */
  email: string;
  /** Versioned salted Argon2id hash; never transport this field. */
  passwordHash: string;
  /** Verification proof is required before password login. */
  verified: boolean;
}
/** Provider identity ownership is unique by provider and stable subject, never by email. */
export interface Identity extends Row {
  /** Owning independent account. */
  userId: string;
  /** Provider issuing the subject identifier. */
  provider: "google" | "discord";
  /** Opaque stable provider subject; Discord snowflakes remain strings. */
  subject: string;
}
/** Opaque hashed authentication session and bound CSRF proof. */
export interface Session extends Row {
  /** Authenticated independent account. */
  userId: string;
  /** Hash of the opaque HttpOnly session cookie. */
  tokenHash: string;
  /** Hash of the CSRF secret returned to the authenticated browser. */
  csrfHash: string;
  /** Last successful authentication instant for sensitive operations. */
  authenticatedAt: string;
  /** Absolute session expiry instant. */
  expiresAt: string;
  /** Explicit logout/recovery/unlink revocation instant. */
  revokedAt: string | null;
}
/** One-use verification or recovery proof, hashed at rest and bound to its account. */
export interface AuthToken extends Row {
  /** Account receiving proof through its private delivery address. */
  userId: string;
  /** Verification and password recovery cannot redeem each other's keys. */
  kind: "verify" | "recover";
  /** Opaque key hash; plaintext exists only during delivery. */
  tokenHash: string;
  /** Absolute expiry; redemption checks time while locked. */
  expiresAt: string;
  /** Atomic redemption marker. */
  usedAt: string | null;
}
/** Browser-bound one-use OAuth authorization state; private and short-lived. */
export interface OAuthState extends Row {
  /** Provider selected when authorization began. */
  provider: "google" | "discord";
  /** Linking target; null means an independent login/signup. */
  userId: string | null;
  /** Hash of browser-visible state. */
  stateHash: string;
  /** Hash of the separate HttpOnly browser binding secret. */
  browserHash: string;
  /** Nonce sent to Google and required in its verified ID token. */
  nonce: string;
  /** Short-lived PKCE verifier for providers supporting it. */
  verifier: string;
  /** Expiring authorization proof. */
  expiresAt: string;
  /** Callback replay marker. */
  usedAt: string | null;
}
/** Owner-confirmed account deletion request; execution is a separate privileged path. */
export interface ErasureRequest extends Row {
  /** Account to erase, established from a recent authenticated session. */
  userId: string;
  /** Time of explicit owner confirmation. */
  requestedAt: string;
  /** Privileged completion timestamp, null until processed. */
  processedAt: string | null;
}
