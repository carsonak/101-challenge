import type {
  AccountMail,
  AuthToken,
  Credential,
  ErasureRequest,
  Identity,
  Notification,
  OAuthState,
  Profile,
  Session,
} from "./accounts.js";
import type { User } from "./common.js";
import type { Audit, Outbox, Replay } from "./events.js";
import type {
  Credit,
  Entitlement,
  Goal,
  GoalRevision,
  Grant,
  Milestone,
  MilestoneRevision,
  Report,
} from "./practice.js";
import type { Attempt, Enrollment, Season, Slot } from "./seasons.js";

/** Typed repository tables; private records remain behind services. */
export interface Tables {
  /** Operator-only content-free suspension; runtime may read but cannot change it. */
  account_suspensions: {
    /** Suspended account UUID. */ id: string;
    /** Operator suspension instant. */ suspendedAt: string;
  };
  /** Owner profiles, unique usernames and private recovery addresses. */
  profiles: Profile;
  /** Owner notification inbox. */
  notifications: Notification;
  /** Retrying content-free deletion email jobs. */
  account_mail: AccountMail;
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
  /** Look up only public account handles with bounded keyset pagination; caller must authorize administration. */
  participantPage(
    prefix: string,
    after: string | undefined,
    limit: number
  ): Promise<{ id: string; username: string }[]>;
  /** Load a bounded page of one participant's attempts, in ID order; caller must authorize administration. */
  participantAttempts(
    userId: string,
    after: string | undefined,
    limit: number
  ): Promise<Attempt[]>;
  /** Read report metadata without loading private body text or values. */
  reportMetadata(
    attemptId: string
  ): Promise<
    Pick<
      Report,
      | "id"
      | "attemptId"
      | "reportingDate"
      | "reportingIndex"
      | "createdAt"
      | "updatedAt"
      | "version"
      | "streakAtReport"
    >[]
  >;
  /** Read report dates/count facts and only today's private report, avoiding history bodies. */
  reportSummary(
    attemptId: string,
    date: string
  ): Promise<{
    dates: { reportingDate: string; streakAtReport: number }[];
    today: Report | undefined;
  }>;
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
  /** Erase only a cancelled current attempt after core authorization. */
  eraseAttempt(userId: string, attemptId: string): Promise<void>;
  /** Serialize provisioning by normalized identity key without taking another user lock. */
  serializeKey(key: string): Promise<void>;
}

/** Database transaction owner; every rejected callback rolls back all writes. */
export interface Repository {
  /** Execute a callback atomically, retrying serialization/deadlock failures with bounded attempts. */
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
}
