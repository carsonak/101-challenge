# Elastic hosting and idle operation

The application supports autoscaling web instances and sleeping or externally
invoked workers. No provider deployment is implied by these instructions. Use
[ADR 0003](adr/0003-idle-workers.md) for security and durability decisions.

## Runtime choices

| Setting            | Execution                                                      | Required host support                                                                         |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WORK_MODE=resident | Private worker/maintenance listeners own sleeping timers       | CPU outside requests, process restart, at least one running instance of each worker           |
| WORK_MODE=request  | Signed /wake completes one bounded sweep and returns nextRunAt | Durable scheduled invocation, failure retries, recovery schedule, sufficient request duration |

Web instances need no resident background polling. The resident option can still
reduce database compute substantially but may incur continuous worker-instance
charges. Request mode permits worker scale-to-zero only after the external
scheduler contract below is installed and tested. Do not use a platform that
freezes CPU between requests with resident mode.

## Durable scheduling contract

A scheduler or dispatch gateway invokes each private POST /wake with no body.
Generate the signature with the exported signWake function: HMAC-SHA256 over
`POST\n/wake\n<worker|maintenance>\n<unix-milliseconds>`, using that service's
64-character hex secret as the HMAC key string. Headers are x-work-timestamp and
x-work-signature. Timestamps expire after sixty seconds; sign again for retries.

For request mode, consume the successful response's ISO nextRunAt and durably
arrange another invocation no later than that time. Replace a later scheduled
wake when an earlier one arrives; do not postpone an existing earlier wake.
At-least-once dispatch and overlapping deliveries are safe. Retry 503/timeouts
with bounded backoff (respect Retry-After). Also install an independent recovery
sweep no less often than WORK_RECOVERY_MAX_MS, so a lost poke, response or process
cannot strand work. Read deadlines after every batch until drained.

Configure WORKER_WAKE_URL and MAINTENANCE_WAKE_URL to the private dispatch gateway
when using request mode. That gateway must relay the signed request, retain the
worker's nextRunAt response and schedule the next invocation before acknowledging
the web's poke. **Pointing the web directly at a request-mode worker is insufficient
for timely future jobs:** the web notifier does not implement a provider scheduler.
It only delivers bounded hints. Alternatively, an external scheduler can own all
invocation and scan on its own cadence, but that trades latency and idle cost.

One-shot commands are available for scheduled container jobs:

- `pnpm start:worker --once`: bounded projection/housekeeping sweep and a JSON
  nextRunAt recommendation (normal diagnostic lines may precede it).
- `pnpm accounts:maintain`: due erasure/mail sweep; nextRunAt is the earliest
  account-work deadline, or null when empty. The scheduler still owns recovery.

These commands exit after releasing their resources. Infrastructure can invoke
commands with scoped credentials instead of exposing a worker HTTP service.

## Private configuration

Generate two independent secrets with a cryptographic generator, such as
`openssl rand -hex 32`. Never commit them. Web receives both wake URLs and keys;
the projection worker receives only WORKER_WAKE_SECRET; maintenance receives only
MAINTENANCE_WAKE_SECRET and its privileged ERASURE_DATABASE_URL. Local launchers
strip other services' credentials. A missing key disables that service's /wake.
Use HTTPS for remote destinations, block public worker ingress, and never put keys
in URLs. Redirects and caller-selected destinations are rejected. Request bodies,
headers and raw private URLs must remain excluded from logs.

The provided Compose stack uses resident mode. In its private env files, configure
web wake destinations as `http://worker:3001/wake` and
`http://maintenance:3002/wake`, with distinct matching keys on the receiving
services. These names are confined to the private Compose network. If wake URLs
are absent, the default recovery sweeps discover work eventually; this fallback
is useful during setup but can delay notices and projection processing.

OUTBOX_POLL_MS/OUTBOX_IDLE_MAX_MS bound batching and failure backoff. Recovery
intervals start at WORK_RECOVERY_MIN_MS and grow to WORK_RECOVERY_MAX_MS when no
immediate work remains. Housekeeping adapts between HOUSEKEEPING_MIN_MS and
HOUSEKEEPING_MAX_MS, with known retention deadlines taking precedence. Pokes
reduce idle delays. Lower bounds limit scan amplification; upper bounds cap missed
signal recovery. Choose a recovery bound consistent with acceptable notice delay
in a wake-delivery outage. Known deletion deadlines are never postponed by it.

DB_POOL_MAX bounds each repository pool, not the whole fleet. The web's readiness
probe creates a separate short-lived pool; worker and maintenance each have their
own. Budget connections across maximum replicas, rolling releases and operator
jobs. Idle clients close after ten seconds. DB_CONNECT_TIMEOUT_MS defaults to
fifteen seconds; measure actual cold-start latency and set provider request
budgets accordingly. Keep PostgreSQL TLS verification enabled.

## Security and user experience

Production web rate limits and mail cooldowns share opaque database counters. A
local ingress limiter and payload validation reject malformed anonymous auth/OAuth
requests before any database reservation.
Replica churn does not reset those buckets. Keep the trusted-forwarded-header
configuration matched to the platform ingress and prevent direct ingress bypass.
Limit replica counts, per-instance request concurrency and ingress request rates;
autoscaling without such limits can turn rejected traffic into a bill. The
Argon2 gate protects each instance's memory, not total fleet spending.

The web shows delayed waiting feedback without retrying mutations or discarding
drafts. Discord signed HTTP commands acknowledge before deferred work, but modal
opening and autocomplete cannot be deferred. A cold web instance must still meet
the initial Discord deadline; retain a warm ingress/instance if measurements require
it. The platform must support Next after lifetime hooks for wake hints and deferred
Discord delivery. Configure request timeouts long enough for a cold connection and
bounded work. SMTP and row locking have finite timeouts; still measure worst-case
batch duration before setting the worker request budget.

Use /api/health and worker /health for routine health checks. Keep /api/ready and
worker /ready private/on-demand for deployment diagnostics: repeated readiness
probes intentionally wake PostgreSQL. Exclude bots, uptime probes, backup activity
and scheduler traffic when interpreting genuine user activity, but account for
all of them in cost measurements.

## Migration and hosted acceptance

1. Back up and preserve the current deletion ledger. Stop old pg-boss workers.
2. Apply migration 0008 and rerun restricted grants; bounded housekeeping now also
   selects opaque record IDs and deletes expired throttle buckets.
3. Deploy matching services and configure private wake delivery. Keep the old
   queue schema for legacy erasure/recovery until separately reviewed removal.
4. Verify empty idle periods cause no queue SQL between scheduled sweeps, then
   report, email failure/retry, deletion without traffic, process loss, concurrent
   replicas, forged wakes and duplicate delivery. Recheck backup restore: the
   outbox is now the queue, so preserve its durability and replay metadata.
5. For request mode, prove gateway/scheduler persistence across termination and
   earlier-deadline replacement before allowing workers to scale to zero.
6. Measure Neon suspension/wake duration, CU-hours, connections and egress over a
   representative period. Verify Discord cold starts, failure alerts, backup and
   independent ledger export. Local tests do not establish provider quotas or cost.
