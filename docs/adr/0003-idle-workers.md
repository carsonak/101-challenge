# ADR 0003: Durable work with sleeping execution

Status: Accepted for implementation, 2026-10-13. Supersedes ADR 0001's requirement
for an independent continuously polling pg-boss runtime. Package boundaries and
synchronous completion remain unchanged.

## Decision

Use the transactional outbox directly as the projection work queue. Restricted
workers lease at most twenty records, reload current state under account locks,
record deduplication receipts, and acknowledge only after successful processing.
Failures have bounded exponential backoff; crashes leave recoverable leases.
Lease-fenced acknowledgements cannot overwrite a newer lease. Eight actual failed
attempts become terminal; merely acquiring a lease does not consume an attempt.

Keep deletion notices and erasure requests in their existing durable tables.
Maintenance executes due deletions before bounded mail delivery, preserving the
account lock, fixed grace deadline and deletion ledger. Ordinary verification and
password-reset mail remain synchronous: plaintext bearer proofs are not added to
an asynchronous queue.

Optional post-commit hints wake workers. They cannot change transaction success
or replace startup/recovery scans. Signed POST /wake accepts no body, resource ID
or job type. Worker and maintenance have distinct signing keys and DB identities.
No wake endpoint is added to the public web app. Internal services require private
ingress and TLS when traffic leaves a trusted local network; HMAC authenticates
requests but does not encrypt them. A replay within the sixty-second window can
only request another rate-bounded scan. Invalid requests perform no DB access.

Resident execution owns one timer per loop, sleeps between sweeps, coalesces
pokes, and backs off empty scans and failures. Persisted deadlines override idle
intervals; an already due batch has at most the configured minimum batching delay.
Housekeeping deletes bounded batches and consults physical retention deadlines.
Routine liveness checks do not query the database. Explicit readiness still does.

Request execution owns no timers and completes a bounded sweep before responding
with nextRunAt. This mode requires a durable external scheduler that uses that
result, plus independent recovery delivery. Platform termination must not discard
future deadlines. This repository defines the protocol and one-shot runners; it
does not provision or claim a selected hosting provider's scheduler integration.

Authentication rate buckets and mail cooldowns use one bounded PostgreSQL
reservation function, private salted opaque keys and database time. Short
transactions serialize reservations across replicas. No plaintext address,
email, user ID or bearer proof is stored in counters. Storage outages fail closed;
Argon2 concurrency remains locally bounded per instance. Infrastructure instance
caps and ingress limits must bound aggregate cost and connections.

## Compatibility and consequences

Migration 0008 requeues published legacy outbox events lacking receipts. Stop old
workers before migration and deploy the new web/worker/maintenance together.
Already processed events remain deduplicated. Legacy pg-boss schema deletion is
not automated; erasure retains its ability to remove legacy scoped jobs. The
pinned pg-boss dependency remains for restricted-role compatibility tests only;
production does not initialize its timers or connections.

Idle operation can permit Neon suspension; it does not guarantee zero billing.
Traffic, deadlines, backups, probes and recovery jobs can legitimately wake the
DB. A lost hint can delay discovery up to the configured recovery maximum; alert
on delivery failure and backlog age. Email transport remains at-least-once: a
crash after SMTP acceptance but before commit may repeat a notice.

No cleanup success is required to enforce session/token/grant expiry. Inbox reads
apply the same retention rules even while physical deletion is deferred. Scheduled
erasure remains required independently of traffic. Logs/backups and current-ledger
exports remain the responsibility of the deployment's existing private automation.

## Rejected alternatives

Keeping pg-boss consumers running preserves constant database activity. PostgreSQL
LISTEN/NOTIFY introduces connection/session and suspension assumptions. Performing
privileged erasure inside public requests breaks credential separation. An
in-memory queue or a post-response timer alone cannot survive PaaS suspension.
