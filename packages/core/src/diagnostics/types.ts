/** Fixed backend events; arbitrary application content is never an event name. */
export type BackendEvent =
  | "http_request"
  | "mail_accepted"
  | "mail_failed"
  | "runtime_ready"
  | "startup_failed"
  | "listening"
  | "shutdown_started"
  | "shutdown_complete"
  | "listener_failed"
  | "queue_failed"
  | "projection_complete"
  | "projection_failed"
  | "housekeeping_complete"
  | "housekeeping_failed"
  | "outbox_complete"
  | "outbox_failed"
  | "discord_action_failed"
  | "discord_delivery_failed"
  | "discord_form_failed";

/** Safe diagnostic metadata; raw requests, errors and configuration are excluded. */
export interface BackendDetails {
  /** Database migration/connectivity checks completed at startup. */
  databaseReady?: boolean;
  /** Queue startup and job registration completed at startup. */
  jobsReady?: boolean;
  /** Sensitive values to remove from exception text; never emitted as metadata. */
  redact?: readonly string[];
  /** Server-generated correlation UUID, never a client-supplied identifier. */
  requestId?: string;
  /** Fixed worker startup operation that failed. */
  stage?:
    "configuration" | "database_readiness" | "queue_start" | "job_registration";
  /** Fixed API route template from diagnosticRoute. */
  route?: string;
  /** Standard HTTP verb; other supplied values are omitted. */
  method?: string;
  /** Completed HTTP response status. */
  status?: number;
  /** Elapsed operation time in milliseconds. */
  durationMs?: number;
  /** Worker listener port, without host or connection configuration. */
  port?: number;
  /** Outbox events successfully delivered in one scan. */
  delivered?: number;
  /** Outbox delivery failures in one scan. */
  failed?: number;
  /** Content-free logical projection processing result. */
  outcome?: "processed" | "duplicate" | "ignored";
}
