# VPS installation and release rehearsal

This is a reviewable procedure, not evidence that a host has been configured.
Use an isolated staging stack first. Close [hosted pilot acceptance](../docs/pilot-readiness.md)
and [manual QA](../docs/manual-qa.md) before invitations. Keep host addresses,
provider identifiers, credentials and detailed operational evidence in private
operator records. Run commands from the repository root. The PR targets main by
owner request; merging or tagging a release requires a subsequent owner decision.

## 1. Establish the target and recovery point

Record the reviewed commit, VPS OS/architecture/resources, free disk, domain,
existing services/ports, database version and backup/restore owner. Verify firewall
rules and dedicated operator access. Reserve a separate database, volumes, domain,
Compose project and storage prefix for staging; never run fixtures on participant
data. PostgreSQL here is 17.11, matching local/CI. If an existing volume contains
18, **do not mount it into 17**: use a separately reviewed logical migration and
restore rehearsal. Never reuse the former 18 volume blindly.

For upgrades, make an encrypted snapshot and independently current ledger first;
restore and migrate a populated disposable copy before touching the live database.
Stop old web/worker/maintenance before migration 0008 and keep old workers stopped.
No in-place rollback migration is supplied.

## 2. Build and pin the release

Install the manifest-selected Node/pnpm and Docker Compose. Use a clean reviewed
checkout, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build` and the
relevant database/browser suites. Build every production target:

```sh
docker compose -f deploy/compose.yaml build web worker maintenance operator
```

In a proxy-CA environment, build targets with
`docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" --target web -t challenge-web .`
and the equivalent target tags. Keep TLS verification enabled. The optional build
secret is never copied into a layer. Provide Compose's build secret configuration
privately if using Compose for those builds.

Record immutable application image IDs/digests and the tested PostgreSQL/Caddy
RepoDigests. Supply POSTGRES_IMAGE and CADDY_IMAGE as reviewed `image@sha256:...`
references in the private Compose environment. Keep the matching app image tags
with the release record; use a private release Compose override with `image:` for
all four targets and deploy with `--no-build`. Validate that exact rendered config
with `config --quiet`; do not print secret-expanded config into shared logs.

## 3. Prepare scoped secrets

Create ignored `deploy/secrets/` mode 0700. Files must be 0600 and readable only by
the operator/Compose. Create `postgres-password`, `operator.env`, `web.env`,
`worker.env` and `maintenance.env`. Use strong unique passwords, URL-encoded in
connection URLs, and PostgreSQL hostname `postgres` inside Compose.

- `operator.env`: OPERATOR_DATABASE_URL, MIGRATOR_DATABASE_URL, QUEUE_SCHEMA and
  MIGRATOR_DB_USER/PASSWORD, WEB_DB_USER/PASSWORD, WORKER_DB_USER/PASSWORD,
  MAINTENANCE_DB_USER/PASSWORD. The operator login matches PostgreSQL's configured
  `challenge_operator`; the initial database is `challenge`.
- `web.env`: restricted web DATABASE_URL, HTTPS APP_ORIGIN, APP_DISPLAY_NAME,
  REPORTING_TIMEZONE, verified SMTP settings, monitored CONTACT_EMAIL and complete
  enabled OAuth configuration. Keep registration tokens and privileged URLs out.
- `worker.env`: restricted worker DATABASE_URL, WORK_MODE=resident and intended
  recovery intervals. No SMTP, OAuth, operator or erasure credentials.
- `maintenance.env`: ERASURE_DATABASE_URL, HTTPS APP_ORIGIN, verified SMTP settings,
  WORK_MODE=resident and its maintenance listener configuration. No operator login.

APP_DOMAIN belongs to Compose interpolation; use the exact domain without a URL
scheme. The topology explicitly trusts one Caddy-overwritten X-Forwarded-For hop.
Only Caddy publishes ports. Adding a CDN/proxy or publishing web changes this trust
boundary and requires revalidation. Never forward caller-supplied addresses intact.

## 4. Bootstrap the database with one-shot jobs

```sh
docker compose -f deploy/compose.yaml up -d postgres
docker compose -f deploy/compose.yaml --profile operator run --rm operator roles
docker compose -f deploy/compose.yaml --profile operator run --rm operator migrate
docker compose -f deploy/compose.yaml --profile operator run --rm operator grants
```

Run each step successfully before the next. Provisioning validates four distinct
nonsuperuser identities. Migration uses only MIGRATOR_DATABASE_URL. Grants follow
migration; restricted runtime logins cannot migrate/promote/erase. No runtime reads
operator.env. A failed phase stops release; diagnose privately, fix configuration
and rerun the idempotent phase. Never grant superuser to make the app start.

## 5. Start and verify services

```sh
docker compose -f deploy/compose.yaml up -d web worker maintenance caddy
```

Check container status and redacted logs. Verify public HTTPS `/api/health` and
`/api/ready`, then worker `/health` and `/ready` and maintenance `/health` and
`/ready` from their own containers using Node fetch. Liveness performs no database
query; readiness must fail with unavailable/missing-migration databases. Verify
static CSS/JS/fonts, CSP nonces, no hydration violations and HSTS. Test the actual
read-only/non-root images, not only a development server.

From two independent client networks, confirm address throttles do not interfere;
for this test use different emails because per-address throttles intentionally
remain shared. Confirm spoofed forwarded headers do not change the Caddy-observed
address. Confirm PostgreSQL, web, worker and maintenance are unreachable externally.

## 6. Establish the first administrator and season

Sign up and verify a fictional/staging admin, then the real intended operator
account through the ordinary flow. Use [support procedures](../docs/support.md)
to verify identity and promote exactly the intended account in a transaction.
Sign out/in and confirm `/admin/seasons`. Create a draft, add at least one goal
and optional milestones/session link, publish, then enroll a separate participant.
Test both recommended and custom setup and the first report.

## 7. Enable providers and operations

Set exact HTTPS OAuth callbacks and the permanent Discord interactions endpoint.
Check Google production consent, authorized domain and privacy URL; verify signed
Discord PING and register/read back the five guild commands with a separate private
registration environment. Never put the bot registration token into web.env.
Complete real login/link/unlink/cancel/conflict paths and the Discord daily loop,
including measured goals and manual milestones on actual clients.

Authenticate the email sender/domain, check SPF/DKIM/DMARC and inbox placement on
Gmail, Outlook and a second domain. Configure and test
[backup/ledger/monitoring schedules](systemd/README.md), off-server encryption,
retention/versioning and an external uptime monitor. Complete a timed restore on
a separate machine with the latest independent deletion ledger. Record RPO and
RTO against the stated 24-hour/four-hour targets. Missing storage/alert/restore
proof blocks invitations.

## 8. Capacity and manual acceptance

Use an isolated staging database ending `_test`, SMTP catcher and production-sized
resources. The burst tool deliberately creates fictional data and cannot target a
normally named database. Set the private restricted web process to that same
disposable database and run from the staging host:

```sh
TRIAL_CONFIRM_SMTP_CATCHER=1 TRIAL_USERS=50 TRIAL_DURATION_MS=120000 node --import tsx scripts/load-trial.ts
```

Supply TRACKER_TEST_DATABASE_URL privately as the disposable operator fixture URL,
and QA_BASE_URL as loopback ingress. Capture tool status/p50/p95/max and
`docker stats --no-stream` during the burst; include peak RSS, CPU, connection
count and restarts/OOM events in the private evidence. Twenty simultaneous report
writes follow signup/login. Run a few avatar uploads through manual QA as well.
Any 5xx, lost/duplicate report, OOM or unexpected restart fails acceptance; inspect
429/capacity errors and stagger invitations in waves of 10–20 before raising limits.
Set and record a latency budget on the actual VPS; Discord's response deadline
remains mandatory. A fast local run does not establish VPS capacity.

Run [manual QA](../docs/manual-qa.md) over two or three reporting days with at least
two people. Fix S1/S2 findings, repeat affected paths, record the final reviewed
commit and only then accept the pilot. The owner decides any weekly community
reminder; measure enrolled users reporting on at least three days in week one.
No community message is sent by these tools.

## 9. Update, rollback and failure handling

For each update: backup/ledger, restore rehearsal, migration compatibility review,
stop affected traffic/workers, migrate, reapply grants, start the pinned release,
readiness plus a fictional sign-in/report, then reopen traffic. Keep previous
images and a record of schema compatibility. If startup fails before writes,
restore the last compatible app images. After incompatible migration or newly
accepted participant reports, prefer a reviewed roll-forward; never overwrite newer
history as routine rollback. Restore into an empty exclusive target and replay the
latest ledger with workers stopped, then verify completion/seed facts and erasures
before routing traffic. Escalate unavailable ledger, database corruption or uncertain
identity; do not improvise destructive SQL.
