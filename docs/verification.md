# Verification evidence

This is a dated historical record, not a statement of current verification.

## Foundation verification

Verified on 2026-10-06 with Node 24.18.0 and pnpm 10.34.6: frozen-lockfile installation, `pnpm check`, production build, and web/worker smoke checks both without database configuration and against isolated PostgreSQL 17.11. Mailpit 1.31.2 health also passed. The web container image built from a clean dependency install, and both non-root web/worker entrypoints passed HTTP smoke checks using that image. These checks verify the skeleton only; feature acceptance tests remain unchecked in the plans. Live OAuth/email delivery and deployment were not configured or tested.

## Local tracker verification

F0–F3 verified with Node 24.18.0, pnpm 12.9.1 and PostgreSQL 17.11: `pnpm check` passed all 29 tests with no skips on a fresh disposable database, `pnpm build` passed, and built web/worker smoke passed both with migrated PostgreSQL and without database configuration. CI now enables the same real database suite instead of silently skipping integration tests.

Production-browser checks with fictional accounts passed signup and local SMTP verification/recovery, login, custom setup, reporting/editing, stale-version text retention and focused errors, cancellation/resumption/restart, admin season/template controls, one-use correction issuance/redemption, owner export, keyboard navigation and mobile widths down to 320 pixels without horizontal overflow. Provider doubles verify actual Google JWT signatures/claims and Discord stable subjects; signed guild fixtures cover private modals, actor/expiry binding, retries and failed delivery. Isolated pg-boss checks cover two workers, queue outages, publish/mark recovery, deduplication, stale projections and housekeeping. Completed-account erasure removes new adapter/worker metadata and prevents replay from restoring it.

These are local implementation checks. Live Google/Discord portals and guild registration, production sender delivery, staging load/pilot, hosted backups and a production restore remain unchecked external release gates. The [operations runbook](operations.md) describes those boundaries; no deployment or artwork runtime is claimed.

## QA initiative

Current evidence and unchecked acceptance criteria are maintained in the [QA overview](../plans/qa-improvements/OVERVIEW.md). Historical results above do not verify subsequent changes.

## Workspace cleanup — 2026-10-11

Integrated schema-reference and worker-diagnostic checkouts were clean and had no service mounts or running application processes. Their commits remain reachable from main and their branches were retained. Completed scratch groups for guidance, adapters, QA and diagnostics were retired after preserving the historical tracker/QA/logging findings already linked above. No repository, credentials, database volume or unrelated service was removed.

## Hardening local and external evidence — 2026-10-11

The final production package/worker/web build passed on the hardened implementation. Final web/worker smoke passed with restricted database logins against disposable PostgreSQL and without database configuration, where readiness correctly remained unavailable. The test runner names individual tests and the permanent sentinel verifies nonzero exit for an intentional temporary failure. Restricted-login fixtures exercise migration ownership, denied reads/writes, queue publishing, housekeeping and account erasure; focused Discord fixtures also exercise measured values, manual milestone checkbox submission, exact accepted revisions during editing and complete-form website fallback.

The isolated encrypted restore rehearsal used actual PostgreSQL pg_dump/pg_restore and checksum-verified age tooling. An older snapshot contained an account later erased; the independently refreshed ledger removed that account and its enrollment after restore. The retained account's 101 reports, completion facts, base seed and participant seed remained unchanged. A second restore into the populated target was deliberately refused. The rehearsal removed its exclusive databases/roles and temporary decryption identity. Remote S3 storage and a VPS restore have not been exercised.

A synthetic full-attempt fixture produced these local observations, with five serial warm samples per read, counting SQL calls without retaining statement text or parameters:

| Read                  | Response bytes | SQL calls | Observed milliseconds |
| --------------------- | -------------: | --------: | --------------------- |
| Owner history         |         242218 |        14 | 58–67                 |
| Discord daily summary |           2906 |        13 | 50–63                 |
| Administrator summary |          27793 |        13 | 38–125                |

The summary avoids retained-attempt graphs and historical report bodies; today's owner report remains available for editing. These measurements describe one local synthetic fixture, not a load or provider-latency guarantee.

Compose parsed successfully without printing secrets. Caddy configuration validation passed in an isolated container. Worker production packaging passed with the same command used by the Dockerfile. Full hardened container builds, server resources, hosted storage and deployment remain unverified.

Live Brevo TLS/authentication passed; the owner-authorized verification and recovery messages were accepted by SMTP. Verification proof was exercised, but the owner reports that neither message arrived. The owner’s transactional logs identify rejection of the unchanged SMTP_FROM placeholder. A follow-up configuration guard rejects .invalid sender domains for external SMTP. All five configuration/readiness tests and package compilation passed for this follow-up; The owner corrected the sender, private maintenance was synchronized, and one recovery retry was accepted by SMTP without changing the account password. The production guard rebuild passed and localhost web/worker/maintenance were restarted with corrected configuration. The owner confirmed the corrected recovery email arrived in the inbox, outside spam. The original verification message had been rejected; separate verification-message delivery remains unconfirmed. SMTP acceptance is not delivery evidence. Configured localhost Google/Discord start routes use the exact callback URLs, Google requests openid/profile without email, and bound cancellation redirects are friendly and clear cookies. Real provider sign-in/linking/profile acceptance remains separate from these local route checks.

A temporary Cloudflare quick tunnel reaches only the exact Discord POST proxy. Public root, GET interactions and query variants returned 404; unsigned exact POST returned 401 after initial cold-start/network delay. Synthetic fixtures verify signed-byte preservation. The owner configured the live portal endpoint and the server recorded a successful signed request during validation. Initial guild access returned 404 and installation required disabling the bot’s code-grant requirement. After owner installation, guild registration succeeded and readback confirmed exactly dashboard, report, seasons, join and help. The owner sees the guild commands, but live invocations initially returned immediate HTTP 400. A signed synthetic fixture reproduced rejection of opaque continuation tokens beyond the unsupported 200-character limit. The limit was removed and webhook URL tokens are encoded; all ten focused Discord/hardening tests passed with no skips. Autocomplete fixtures now use unique season names to avoid accumulated synthetic-data collisions. The production rebuild and restricted-login smoke passed, and the fixed localhost app was restarted; readiness is 200 and unsigned proxy requests remain 401. The owner confirmed help/dashboard commands now respond. Structured Markdown copy subsequently passed all ten focused tests, production build and restricted-login smoke, and is running. Live join/report/pause flows remain pending. Discord OAuth start and bound cancellation pass inside WSL. Windows initially could not reach the loopback site: the web port was inside a Windows reserved TCP range. A harmless unreserved loopback probe returned 200 from Windows; after adjusting private local origins, the actual login page also returned 200 from Windows. Web/worker readiness and proxy signature rejection remained correct, and the tunnel endpoint was preserved. Matching new provider-console callbacks and interactive sign-in/linking remain pending.

Browser screenshot review covered the notebook/lake palette, heading/body distinction, static 101-cell pattern, narrow navigation and separated cancellation surface. Desktop Home was refined to put daily context alongside the grid and label empty private history. A production Zod code-generation probe initially produced caught CSP violations; shared validation was changed to the runtime parser and the focused rebuilt-page check reported none. The final production-browser run passed all seven tests without retries, including 120 route/theme/viewport combinations at 320, 768 and 1440 pixels, automated WCAG checks, keyboard and enlarged-text checks, reduced motion, and no CSP or hydration violations. Final screenshot review confirms the refined desktop Home and narrow-screen layouts. The full `pnpm check` before the continuation-token follow-up passed with 57 named tests, zero failures and zero skips against isolated PostgreSQL, including actual restricted-login privilege checks. Typechecking, lint, boundaries, formatting and documentation checks passed.

A subsequent owner browser check exposed stale localhost cookies: session bootstrap returned 401, hiding configured OAuth buttons and showing an availability error. Bootstrap now clears invalid, expired or revoked session/CSRF cookies and returns anonymous context with provider availability. Valid account/deletion access remains intact; database failures still return 503 without clearing cookies. The focused service-double and real PostgreSQL browser-API regressions passed with no skips; lint and package boundaries passed.

The follow-up production build passed. After restarting the local app, a Chromium check with fictional stale cookies confirmed that Google and Discord buttons appear on login and signup, expired cookies are removed, and public pages show no availability toast. Live readiness and anonymous provider discovery returned 200. This checks browser bootstrap, not interactive provider consent. The disposable smoke stack initially exceeded its startup deadline; an extended run exposed a fixture selection error: the service tests used an operator-owned integration database instead of the separately provisioned restricted-login browser database. Smoke startup allowance is now explicitly configurable through SMOKE_STARTUP_TIMEOUT_MS (default 30000, bounded to 1000–300000), without retries. Restricted-login smoke must use the provisioned browser database; operator-owned integration fixtures are separate. The correctly selected fixture then exceeded the five-second HTTP allowance under host load. SMOKE_REQUEST_TIMEOUT_MS now provides a bounded allowance (default 5000, range 1000–120000), and transport failures identify their safe route; the final check uses an explicit 30000 HTTP allowance and 120000 startup allowance.

The restricted-login production web/worker smoke check passed against the provisioned disposable browser database with those explicit allowances. The initial failed runs remain part of the evidence; no automatic retries were introduced.

On 2026-10-11, an owner migration-command failure exposed stopped local PostgreSQL and a command that loaded the restricted web environment. PostgreSQL was restarted and the command now loads a separate ignored .env.migrations, or an explicitly supplied process DATABASE_URL. The normal pnpm database:migrate command passed with the dedicated migrator; the web login remained nonsuperuser, without role management or schema CREATE. CLI checks confirmed useful credential-free diagnostics for missing configuration, refused connections and restricted-login denial. Lint, boundaries, formatting and documentation checks passed for this follow-up.

## Configuration and developer diagnostics follow-up — 2026-10-11

Local setup now uses two ignored files: runtime .env and privileged .env.operator, each with a complete tracked example. The earlier split migration, worker, maintenance, registration and proxy files are superseded. Launchers select credentials by command, reject web-login fallback for worker/migration commands, and strip inherited privileged settings from application environments. Inventory and isolation tests cover the examples and shell overrides. The normal migration command and Discord registration dry run passed with the consolidated configuration.

CLI failures now preserve redacted stacks, nested causes and database/transport codes, with an actionable next step and optional structured JSON output. Tests cover both output modes and prevent credentials, email addresses, proof values and arbitrary SQL properties from appearing. Browser-facing errors remain generic.

The production build and restricted-login production smoke passed. The full browser suite passed eight tests without retries, covering route/theme/viewport review, accessibility, CSP, hydration, keyboard use and stale-cookie recovery. A separate focused browser run with fictional enabled provider configuration passed through the new launcher. Screenshots of login/signup and Home were inspected in light/dark themes and narrow/desktop layouts; all retained screenshots use synthetic fixtures. No external provider consent or account linking was exercised by these browser checks.

The final configuration audit found no configured secrets or owner email values in tracked or eligible files. Live provider consent/linking, additional Discord daily-loop acceptance, separate verification-email delivery and VPS launch remain outstanding external gates.

The final full pnpm check passed 62 named tests with zero failures and zero skips against disposable PostgreSQL. Typechecking, lint, package boundaries, formatting and documentation checks passed; the production build, restricted-login smoke and browser evidence above are separate checks. Font license files received whitespace-only normalization during the staged diff review.

## Maintainability audit and refactor — 2026-10-12

The refactored implementation passed the full `pnpm check` with 66 named tests,
zero failures and zero skips against disposable PostgreSQL 17.11. Typechecking,
lint/package boundaries, Prettier, AST-aware statement spacing, production
300-line limits, documentation/seed checks and Redocly validation passed. The
production build and web/worker smoke passed with actual restricted logins and
without database configuration. Licensed font assets remain unchanged.

Restricted-login verification exposed non-inheriting membership granted to a
non-superuser migrator when it creates the erasure role. Provisioning now applies
`WITH INHERIT TRUE` explicitly. The extended topology regression accepts 101
reports, preserves the completion guard and erases the completed account using
the maintenance login. The normal grants step repairs existing configured stacks;
no schema migration is required.

The YAML conversion's dereferenced comparison preserved all original components
and operation contracts except reviewed documentation corrections: stale-session
bootstrap returns anonymous HTTP 200 and clears cookies, and unreachable blanket
GET error responses were removed. Redocly's external YAML bundle command passed;
permanent coverage checks references and both runtime command registries, including
nested grant alternatives.

All eight production-browser tests passed without retries. The route matrix covered
120 combinations of 20 routes, two themes and 320/768/1440-pixel widths, alongside
keyboard, enlarged-text, accessibility, reduced motion, CSP and hydration checks.
Synthetic screenshots were inspected in both themes at narrow and desktop widths.
An initial CSS layer-order regression was fixed before the accepted run by declaring
layer order in every module and preserving override specificity.

Public authentication and tracker factory types were checked for assignability
in both directions against the original source contracts. Compiled local package
imports were checked for runtime cycles; none were found. Operational TypeScript
scripts are now included in aggregate typechecking.

A fresh encrypted backup/restore rehearsal used checksum-verified age tooling and
PostgreSQL 17 dump/restore tools against exclusive disposable databases. Restoring
101 reports preserved completion and seed facts; the newer deletion ledger erased
one account absent from the older snapshot's ledger. A populated restore target
was deliberately refused. An initial test-tool wrapper omitted the database name;
that failed rehearsal was retained and the wrapper corrected before the accepted
run. Hosted storage durability and server restore remain unverified.

The ignored local OAuth callback settings were aligned with the configured loopback
origin without changing credentials. Safe configuration validation passed. Live
provider-console callbacks, consent/linking/profile checks, verification-message
delivery and the linked Discord daily loop remain owner-assisted gates. The local
default database port was occupied by a system PostgreSQL service that rejected
the configured operator credentials. The owner selected an alternate port;
the private project Compose database is healthy there. Ignored runtime/operator
targets and restricted logins were aligned, then role provisioning, migrations
and grants passed. Private web/worker readiness and the login page returned 200.
The foreground exact-route tunnel returned 401 for unsigned Discord POSTs and
404 for root, GET and query variants. Guild registration dry-run passed; no
registration write or owner interaction is claimed. No unrelated database,
provider console, sender or hosted deployment was modified.

The owner's subsequent worker launch used Node 22.15.0 and failed before startup
because that runtime lacks the built-in Argon2 export. Local launchers now check
the manifest's Node engine range before application imports and explain how to
select Node 24. The actual Node 22 launcher was verified to fail with that message;
mise selected installed Node 24.20.0. All five focused setup tests passed,
including engine boundaries, with no skips; lint, source limits and documentation
checks passed. The temporary acceptance worker was stopped for the owner's
development-worker handoff. The owner confirmed configuring provider URIs;
interactive consent, linking and delivery evidence remain pending.

Before the owner-requested workspace backup, fresh localhost probes returned 200
for login, liveness, readiness and anonymous session bootstrap. Google and Discord
OAuth start POSTs returned 200 and authorization URLs with the configured localhost
callbacks. A POST using the alternative loopback hostname returned 403, confirming
the exact-origin boundary; these checks do not prove provider consent or linking.
Final lint, formatting and source checks passed. The owner then authorized a backup
commit and push of the current maintainability changes; private configuration and
external artifacts are excluded from that backup.

## Local MVP readiness and compatibility — 2026-10-13

The owner confirmed Discord login, Google linking and recovery-address delivery
and verification after correcting provider-console callback ports. Read-only
inspection confirmed one finalized profile with both provider identities and a
verified recovery address; no verified password credential was present. No owner
identity or private account content is included in this record. These checks do
not establish Google first-login, cancellation/conflict/profile cases,
password-signup verification delivery or linked Discord daily-loop acceptance.

The web launcher now prints the canonical browser origin. The worker emits a
startup runtime_ready record with allowlisted databaseReady/jobsReady booleans,
while empty outbox scans remain quiet. API regressions reject alternate hostnames,
ports, foreign and absent origins before creating OAuth state. An append-only
migration baseline fixes the existing seven SQL files by version, order and hash.
A populated baseline upgrade regression preserves verified login, both linked
providers, 101 reports, retained history, completion and seed facts through the
current migrator and its reapplication. The current migration range is unchanged;
future appended migrations must continue to pass this populated fixture.

Fresh pnpm check passed 71 named tests with zero failures and zero skips against
an exclusive disposable PostgreSQL cluster. Typechecking, lint/boundaries,
formatting/statement spacing, production file limits, documentation/seed checks
and OpenAPI validation passed. The first run found a pre-existing erasure
fixture whose fixed seven-day deadline had reached the real database clock; the
test now sets an explicitly future maintenance deadline before its rejection
check and retains a separate past-deadline success case. Its restricted auth
adapter also shares the fixture clock. The new upgrade fixture's account snapshot
was corrected to capture provider links before comparison. Failed runs remain
separate from the accepted evidence.

The production build passed. The production smoke runner passed with restricted
web/worker logins and without database configuration, asserting exactly one
worker startup summary and the expected readiness flags. A deliberate missing
database produced a database_readiness startup failure, no runtime_ready claim,
a nonzero exit and clean shutdown without exposing the connection password.

All nine browser scenarios passed with retries disabled against a production
build, fictional enabled Google/Discord clients and isolated Mailpit/PostgreSQL.
The OAuth scenario clicks both provider buttons on login and signup, intercepts
external navigation and checks callback URLs, scopes, state, binding cookies and
Google nonce/PKCE. The route matrix passed 120 combinations of 20 routes, both
themes and 320/768/1440-pixel widths, plus accessibility, keyboard, enlarged text,
reduced motion, CSP and hydration checks. All twelve anonymous authentication
screenshots and representative Home/account views were inspected; no clipping or
overlap was observed. An installed Chromium was selected through the documented
executable override.

The first browser setup rejected an invalid fictional SMTP sender; it was
corrected and the harness now validates configuration before launch. A subsequent
nine-test run was interrupted by SIGTERM after eight passing scenarios during
the route matrix. Accepted completion came from two separate zero-exit runs on
the same implementation: the full route matrix, then the eight browser flows.
The interrupted run is preserved and does not count as a completed suite.
Synthetic logs and screenshots remain outside the repository; private account
storage was not used by these tests.

The local follow-up gates are complete. Hosted backup durability, server restore,
remote CI and the owner's hosted path review remain separate gates. See the
[pilot checklist](pilot-readiness.md) and [compatibility policy](compatibility.md).

## Pre-QA readiness acceptance — 17 October 2026

Historical result for the pre-QA application and operations implementation in
this PR, followed by evidence/reference updates. Node 24.19.0,
pnpm 12.11.2 and PostgreSQL 17.11 were used with fictional disposable fixtures.

- `pnpm check` passed all 96 named tests with zero skips, including actual
  restricted logins, immutable migration checks, populated upgrade, shared rate
  buckets, suspension access/denied writes/erasure, stale credential proofs and
  backup producer/freshness failure cases. Original applied migrations are unchanged.
- Production build passed. Web/worker smoke passed with restricted database
  identities and without database configuration (readiness correctly unavailable).
- All 15 Playwright tests passed. The route matrix covers light/dark at phone,
  tablet and desktop widths, WCAG scans, keyboard, reduced motion, 200% text, CSP
  and hydration. Four focused scenarios passed again after improving screenshot
  capture position; synthetic resend/correction/setup/completion screenshots were
  visually inspected. Artifacts remain external to the repository.
- All four final Docker targets built. Non-root source ownership fixes operator
  and maintenance execution from restrictive source checkouts. A fresh isolated
  roles/migrate/grants sequence passed in the one-shot image. Web/worker/maintenance
  ran with read-only roots and documented resource limits; all liveness/readiness
  paths passed, eleven web static assets loaded, the cache was writable and root
  application writes were rejected. No OOM was observed during this smoke.
- Compose validated using synthetic secrets with only path substitutions; Caddy
  configuration and systemd units validated. Production PostgreSQL/Caddy defaults
  pin the locally inspected image digests. Actual host installation is unperformed.
- The actual age-encrypted PostgreSQL dump/restore rehearsal passed, including
  independently newer deletion-ledger replay: 101 reports restored, one erased
  account removed and completion/seed facts stable. The fixture measured about
  eight seconds. Its intentional second restore into a populated target rejected.
  This is local recovery evidence, not off-server durability or a hosted RTO.
- A separate local twenty-user signup/login trial over two minutes accepted all
  61 measured HTTP writes and persisted exactly twenty concurrent reports. Latency
  was p50 186 ms, p95 442 ms and max 585 ms. These observations do not establish
  the fifty-user VPS capacity gate or memory/CPU acceptance.

Initial verification found route mounting and enlarged-footer overflow defects;
both were fixed before the final browser pass. Container execution found source
ownership and synthetic SMTP configuration issues; final runtime checks used the
submitted ownership fix and valid fictional catcher settings. Producer failure
regressions and real encryption/restore evidence are distinct.

Remaining release gates: real inbox placement and authenticated sender DNS,
Google/Discord consent/link/unlink/conflict/daily-loop/client checks, two-network
ingress trust/firewall validation, actual-VPS load and failure recovery, installed
alert delivery and external uptime monitoring, scheduled off-server/versioned
backups with independently current ledger and timed separate-machine restore,
monitored CONTACT_EMAIL, qualified legal/privacy review and the complete owner-led
manual QA pass across reporting-day boundaries. See [the checklist](pilot-readiness.md),
[manual QA](manual-qa.md), [support](support.md) and [VPS runbook](../deploy/runbook.md).
No production deployment, provider-console mutation, invitation, merge or release
tag is claimed by this record.

Before review, the account-flow audit additionally found the unverified-email
confirmation dead end (A10). The follow-up uses working provider proof until the
email credential is verified, and labels its status. Production build and all
16 browser tests passed, including a direct unlink/session-revocation regression;
its synthetic account screenshots were inspected. The original pushed PR revision
also passed GitHub CI.

The follow-up web image rebuild encountered HTTP 503 from the package registry.
The successful four-image/bootstrap/read-only acceptance above predates this
UI-only follow-up; the Dockerfile is unchanged. Repeat the final web image build
after package connectivity recovers, before VPS acceptance.
