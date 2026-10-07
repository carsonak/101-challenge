# Tracker operations

The local F3 gate uses fictional accounts, Mailpit, provider transport doubles and signed Discord fixtures. It does not authorize deployment, provider registration or production account provisioning. See the [release gates](../plans/v0.1-challenge-tracker/OVERVIEW.md).

## Startup and ownership

Install the pinned workspace, start PostgreSQL/Mailpit, then run `pnpm database:migrate` with schema-owner credentials before `pnpm dev:web` and `pnpm dev:worker`. Production uses `pnpm build`, `pnpm start:web` and `pnpm start:worker`. Configure `APP_ORIGIN` to the exact HTTPS origin; only loopback HTTP is accepted. OAuth callbacks must be exactly `/api/auth/google/callback` and `/api/auth/discord/callback` on that origin. Blank provider settings hide those buttons. SMTP uses TLS outside loopback; the production email gate verifies sender identity and delivery.

Web transactions select the restricted `challenge_tracker_app` role. Provision an application login that can assume only that role; keep migration, worker maintenance and erasure credentials separate. The local schema-owner connection is a development convenience, not a production credential model. Administrator assignment belongs to explicitly authorized provisioning, with no public promotion endpoint or broad operator CLI. Erasure is an owner-confirmed request followed by the private privileged service described in [authentication](authentication.md).

`/api/health` and worker `/health` check liveness. `/api/ready` and worker `/ready` require all four tracker migrations; worker startup checks them before initializing queue handlers. Use an exclusive `QUEUE_SCHEMA` and database for each environment/task. Queue startup failure stops the worker; a queue outage does not prevent the web service committing reports or completion.

## Administrator provisioning

Register and verify the intended account through the ordinary browser signup flow first. An explicitly authorized operator uses the database-owner connection to locate exactly that verified credential and update its matching `users.admin` flag in a transaction. Confirm the affected account and verify unrelated accounts remain unchanged before committing. Refresh the browser afterward: permissions are read from the database, not permanently embedded in the session. The restricted application role cannot update this flag; no browser signup field or public endpoint grants administrator access. Production provisioning needs its own controlled operator connection and access record.

## Backend diagnostics

Application diagnostics are JSON lines in the terminal running `pnpm dev:web` or `pnpm dev:worker`; production commands write to the same stdout/stderr streams for the hosting log collector. Browser console output is separate. API completion records include a timestamp, service, severity, fixed route template, HTTP method, status, duration and a server-generated request ID. Find that ID in the response's `x-request-id` header in the browser Network panel to correlate a failure with its backend record. Expected 4xx responses are warnings; 5xx responses are errors. Runtime initialization failures also produce a correlated record. SMTP success/failure records expose delivery duration and safe error codes, never recipients or verification/recovery links. Discord deferred action/delivery failures retain that same request ID.

Error diagnostics include only recognized domain, transport or PostgreSQL codes and fixed error categories. For example, `ECONNREFUSED` indicates a refused connection, `42P01` a missing table, and `42501` insufficient database privileges; unrecognized errors use `INTERNAL`. Raw exception messages, stacks, SQL, request/response bodies, email addresses, cookies, tokens, provider codes and query strings are omitted. Unrecognized URL paths become `unmatched`; season IDs become a fixed route parameter.

Worker records cover startup, listener/queue failures, shutdown, projection outcomes, housekeeping and nonempty outbox delivery/failure counts. Empty two-second publisher scans do not generate noise. The existing private failure inspection remains available for terminal event metadata. Capture these streams in deployment, restrict operator access and enforce the thirty-day retention limit below. Framework development logs are separate and may include URLs; use synthetic accounts locally and configure the production proxy/collector redaction described below.

## Queue recovery

The publisher leases at most twenty pending content-free events per scan. Expired leases recover a process crash. Transport failures retain the event, increment the attempt count and back off; eight unsuccessful publishing attempts become terminal. A crash after publish but before mark may deliver again. Event receipts deduplicate logical processing. Workers reload the attempt under the account lock; stale source versions do not replace a newer projection, and deleted accounts/events are ignored. Completion stays synchronous in the command transaction.

The `tracker_projection` queue retries processing five times with thirty-second exponential backoff. Housekeeping runs hourly and can safely repeat: expired session/verification/recovery/OAuth/form/replay proofs are removed, expired grant hashes remain at most thirty additional days, and published outbox/receipt metadata expires after thirty days. Queue jobs also have thirty-day retention. No reminder or artwork jobs are registered. Stop the publisher, await its active scan, stop handlers, then close database connections on termination.

Inspect terminal publisher failures through private `createJobStore(...).failures()` using maintenance credentials. Results contain event/resource IDs, types, attempts and timestamps only. Queue failure inspection must likewise exclude payloads or arbitrary exception strings from public logs. Diagnose the cause before an explicitly authorized scoped retry; do not reset every environment's jobs. A restored queue can deliver duplicates safely.

## Redaction and incidents

Application messages log service availability without request bodies, email addresses, OAuth codes, tokens, correction keys, password hashes or seeds. Configure reverse proxies to omit query strings and request/cookie/authorization headers, particularly on verification/recovery and OAuth callbacks. Browser responses use `no-referrer`; private queries use `no-store`. Do not collect proof-bearing URLs in analytics. Keep operational logs for at most thirty days with access restricted to operators. Restrict backups and verification artifacts similarly; use synthetic accounts for diagnostics.

For an incident, restrict traffic if needed, record safe event/resource IDs and timestamps, revoke compromised sessions/grants through the existing authorized services, rotate the affected secret and verify readiness before reopening. Never include participant text or proof material in tickets. Keep corrective actions scoped and preserve database evidence without copying private data into repository artifacts.

## Backup and restore

Encrypted backups have a thirty-day maximum retention and require access separate from the web runtime. Keep the current deletion ledger separately recoverable from the backup being restored. Its only retained fields are erased account UUID and erasure timestamp, not identity fingerprints.

Restore into an isolated database with traffic and workers stopped. Apply the tracked migrations, then replay the current ledger with the private privileged `replayErasures` service before enabling traffic; this removes restored account graphs and scoped queued work. Reconcile current erasure requests, verify completion immutability, compare safe counts and run synthetic reporting/authentication/readiness checks. Document an actual timed restore and deletion-ledger replay during the external hosting/release gate. The local PostgreSQL tests prove service behavior, not a production backup system or disaster-recovery exercise.

Protocol references: [Discord interaction responses](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx), [pg-boss queues](https://pgboss.io/api/queues) and [scheduling](https://pgboss.io/api/scheduling).

## Account maintenance

Schedule `pnpm accounts:maintain` once per minute in a separate operator-owned process. Supply ERASURE_DATABASE_URL only to that process, alongside SMTP settings, APP_ORIGIN and the owning QUEUE_SCHEMA. The command deliberately does not load the web .env. Its connection must have the existing privileged erasure capability plus access to the account-mail queue and profiles. It retries recovery notices, checks due requests under account locks and removes due accounts through the deletion-ledger path. Web runtime credentials must never inherit these privileges.

If maintenance is unavailable, account access remains suspended and recovery still stops at the deadline; actual erasure waits for the next successful sweep. Monitor the age of due unprocessed requests and unsent account_mail records without logging recipient addresses. Alert on a due request older than five minutes. Retry the sweep after correcting transport/database failures; do not restart the grace period.

Migration 0005 recovers first publication from existing PublishSeason audit events. Unknown values remain null and block backdating until an administrator supplies a verified timestamp in the season editor. Existing resumable cancellations migrate to paused without retroactive benefit loss. Apply migrations before application rollout; validate on a restored disposable copy first. Downgrading the application after new lifecycle states are used is unsupported; roll forward with fixes.

LOG_FORMAT accepts auto, pretty or json. Auto pretty-prints sanitized diagnostics only in interactive non-production terminals; redirected and production logs remain JSON. Formatting never expands the diagnostic data allowlist.
