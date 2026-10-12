import type { Row } from "./common.js";

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
