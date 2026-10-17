# Tracker operations

The local F3 gate uses fictional accounts, Mailpit, provider transport doubles and signed Discord fixtures. It does not authorize deployment, provider registration or production account provisioning. See the [release gates](../plans/v0.1-challenge-tracker/OVERVIEW.md).

## Startup and ownership

Install the pinned workspace and start PostgreSQL/Mailpit. Provision the four logins and worker-owned queue schema using [deployment setup](deployment.md), and migrate with the dedicated migrator before starting the web and worker. Production uses `pnpm build`, `pnpm start:web` and `pnpm start:worker`. Local web/worker commands select their own restricted connection from .env; operator settings stay in .env.operator. See [configuration](configuration.md) for the two examples and command scopes. Configure `APP_ORIGIN` to the exact HTTPS origin; only loopback HTTP is accepted. OAuth callbacks must be exactly `/api/auth/google/callback` and `/api/auth/discord/callback` on that origin. Blank provider settings hide those buttons. SMTP uses TLS outside loopback; the production email gate verifies sender identity and delivery.

Web transactions select the restricted `challenge_tracker_app` role. Provision an application login that can assume only that role; keep migration, worker maintenance and erasure credentials separate. The local schema-owner connection is a development convenience, not a production credential model. Administrator assignment belongs to explicitly authorized provisioning, with no public promotion endpoint or broad operator CLI. Erasure is an owner-confirmed request followed by the private privileged service described in [authentication](authentication.md).

`/api/health` and worker `/health` check liveness. `/api/ready` and worker `/ready` require all tracked tracker migrations; resident worker startup checks them before enabling execution. Use an exclusive `QUEUE_SCHEMA` and database for each environment/task. Resident startup failure stops the worker; a queue outage does not prevent the web service committing reports or completion.

## Administrator provisioning

Register and verify the intended account through the ordinary browser signup flow first. An explicitly authorized operator uses the database-owner connection to locate exactly that verified credential and update its matching `users.admin` flag in a transaction. Confirm the affected account and verify unrelated accounts remain unchanged before committing. Refresh the browser afterward: permissions are read from the database, not permanently embedded in the session. The restricted application role cannot update this flag; no browser signup field or public endpoint grants administrator access. Production provisioning needs its own controlled operator connection and access record.

## Backend diagnostics

Application diagnostics appear in the terminal running `pnpm dev:web` or `pnpm dev:worker`. LOG_FORMAT=auto uses readable text in interactive development terminals and JSON lines in production or redirected output; production commands write to stdout/stderr for the hosting log collector. Browser console output is separate. API completion records include a timestamp, service, severity, fixed route template, HTTP method, status, duration and a server-generated request ID. Find that ID in the response's `x-request-id` header in the browser Network panel to correlate a failure with its backend record. Expected 4xx responses are warnings; 5xx responses are errors. Runtime initialization failures also produce a correlated record. SMTP success/failure records expose delivery duration and safe error codes, never recipients or verification/recovery links. Discord deferred action/delivery failures retain that same request ID.

Operator-only error diagnostics include exception messages, stacks, original codes, nested causes and aggregate errors. HTTP responses retain their separate user-facing messages and never include these diagnostics. Recognized domain, transport and PostgreSQL codes also provide searchable categories. For example, `ECONNREFUSED` indicates a refused connection, `42P01` a missing table, and `42501` insufficient database privileges; unrecognized errors use `INTERNAL`. Recognized codes are also extracted from bounded cause and aggregate-error chains. Infrastructure failures include fixed troubleshooting hints; `MIGRATIONS_REQUIRED` means to run `pnpm database:migrate`. Worker startup failures are logged with redacted diagnostics after resources are released. Known environment secrets, connection URL credentials, email addresses and proof-bearing URL parameters are redacted from exception text. Request/response bodies and arbitrary exception properties (including query and detail fields) are omitted. Callers can supply additional sensitive values for redaction. Error producers must avoid embedding participant text or proofs in exceptions; text redaction cannot identify arbitrary private content. Unrecognized URL paths become `unmatched`; season IDs become a fixed route parameter.

Worker records cover startup, listener/queue failures, shutdown, projection outcomes, housekeeping and nonempty outbox delivery/failure counts. The worker emits one runtime_ready summary after listener startup and execution setup, with boolean databaseReady and jobsReady fields. Without database configuration both are false: only liveness is available. Request mode leaves databaseReady false until an explicit check or sweep; the summary describes startup, not continuous health. Use /ready deliberately to check readiness. Browser API requests and synchronous authentication/email delivery are logged by web, not worker. Privileged account-mail retries and erasure run in the separate maintenance process. Empty work scans sleep until the next deadline or coarse recovery sweep and do not generate noise; wake_failed records a lost delivery hint. The existing private failure inspection remains available for terminal event metadata. Capture these streams in deployment, restrict operator access and enforce the thirty-day retention limit below. Framework development logs are separate and may include URLs; use synthetic accounts locally and configure the production proxy/collector redaction described below.

## Queue recovery

The worker leases at most twenty content-free outbox events per sweep and processes
those records directly. No pg-boss polling runs. Expired leases recover crashes;
actual failures increment the retry count and back off, becoming terminal after
eight failures. Lease-fenced acknowledgement cannot overwrite a newer claim.
Receipts deduplicate a crash after processing but before acknowledgement. Workers
reload the attempt under the account lock; stale versions and deleted accounts
cannot replace current truth. Completion stays synchronous.

Housekeeping uses bounded batches and adaptive intervals, with known retention
deadlines taking precedence. Expired session/verification/recovery/OAuth/form/replay
proofs and throttle buckets are removed; expired grants and published outbox/receipt
metadata retain their thirty-day policy. Inbox retention is shared with reads:
acknowledged notices expire after thirty days, unread after ninety. Routine owner
actions do not create inbox entries. No reminder or artwork jobs are registered.

Inspect terminal failures privately through createJobStore(...).failures(); results
contain IDs, types, counts and timestamps only. Scope and authorize manual retries.
Stop accepting wake requests, await active sweeps and then close connections.
See [elastic hosting](elastic-hosting.md) for resident versus request execution,
signing keys, missed-signal bounds and the required external scheduling contract.

## Redaction and incidents

Application messages log service availability without request bodies, email addresses, OAuth codes, tokens, correction keys, password hashes or seeds. Configure reverse proxies to omit query strings and request/cookie/authorization headers, particularly on verification/recovery and OAuth callbacks. Browser responses use `no-referrer`; private queries use `no-store`. Do not collect proof-bearing URLs in analytics. Keep operational logs for at most thirty days with access restricted to operators. Restrict backups and verification artifacts similarly; use synthetic accounts for diagnostics.

For an incident, restrict traffic if needed, record safe event/resource IDs and timestamps, revoke compromised sessions/grants through the existing authorized services, rotate the affected secret and verify readiness before reopening. Never include participant text or proof material in tickets. Keep corrective actions scoped and preserve database evidence without copying private data into repository artifacts.

## Backup and restore

Encrypted backups have a thirty-day maximum retention and require access separate from the web runtime. Keep the current deletion ledger separately recoverable from the backup being restored. Its only retained fields are erased account UUID and erasure timestamp, not identity fingerprints.

Restore into an isolated database with traffic and workers stopped. Apply the tracked migrations, then replay the current ledger with the private privileged `replayErasures` service before enabling traffic; this removes restored account graphs and scoped queued work. Reconcile current erasure requests, verify completion immutability, compare safe counts and run synthetic reporting/authentication/readiness checks. Document an actual timed restore and deletion-ledger replay during the external hosting/release gate. The local PostgreSQL tests prove service behavior, not a production backup system or disaster-recovery exercise.

Protocol reference: [Discord interaction responses](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx).

## Account maintenance

Run `pnpm accounts:schedule` as a private sleeping service, or invoke `pnpm accounts:maintain` through a durable scheduler that honors its nextRunAt result. Supply ERASURE_DATABASE_URL only to that process, alongside SMTP settings, APP_ORIGIN and the owning QUEUE_SCHEMA. The local launcher shares SMTP/origin settings from .env but passes only maintenance ERASURE_DATABASE_URL from .env.operator; production supplies a scoped environment. Its connection must have the existing privileged erasure capability plus access to the account-mail queue and profiles. It checks due requests under account locks and removes due accounts through the deletion-ledger path before delivering a bounded batch of recovery notices. Future retries and deletions determine the next wake; empty queues use coarse recovery sweeps. Web runtime credentials must never inherit these privileges.

If maintenance is unavailable, account access remains suspended and recovery still stops at the deadline; actual erasure waits for the next successful sweep. Monitor the age of due unprocessed requests and unsent account_mail records without logging recipient addresses. Alert on a due request older than five minutes. Retry the sweep after correcting transport/database failures; do not restart the grace period.

Migration 0005 recovers first publication from existing PublishSeason audit events. Unknown values remain null and block backdating until an administrator supplies a verified timestamp in the season editor. Existing resumable cancellations migrate to paused without retroactive benefit loss. Apply migrations before application rollout; validate on a restored disposable copy first. Downgrading the application after new lifecycle states are used is unsupported; roll forward with fixes.

LOG_FORMAT accepts auto, pretty or json. Auto pretty-prints sanitized diagnostics only in interactive non-production terminals; redirected and production logs remain JSON. Both formats include the same operator exception details and redaction.

## Pre-invitation procedures

Use [participant support](support.md), [manual QA supplements](manual-qa.md), the
[numbered VPS runbook](../deploy/runbook.md) and [private timer templates](../deploy/systemd/README.md).
The operations checker emits fixed outcomes and returns failure for unavailable
readiness, overdue erasures/mail/outbox work or a remote backup older than 26 hours.
It sends no alerts itself; install and test operator alert routing and external
uptime monitoring. Reconcile current account suspensions after restore before
opening traffic; snapshots can contain an older operational access state.
