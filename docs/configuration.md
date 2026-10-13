# Local configuration

Local setup uses two private files, with matching tracked examples:

| File                                                                | Contents                                                                                                  | Read by                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [.env.example](../.env.example) → `.env`                            | Shared runtime settings, restricted web/worker connections, SMTP, browser OAuth and the Discord proxy     | Local runtime commands; selected shared settings also reach operator commands |
| [.env.operator.example](../.env.operator.example) → `.env.operator` | PostgreSQL bootstrap/provisioning, migrator and maintenance connections, Discord registration token/guild | Only provisioning, migration, maintenance and registration commands           |

```sh
cp .env.example .env
cp .env.operator.example .env.operator
chmod 600 .env .env.operator
pnpm install --frozen-lockfile
pnpm services:up
pnpm database:provision roles
pnpm database:migrate
pnpm database:provision grants
pnpm dev:web
# In another terminal:
pnpm dev:worker
```

This sequence is for a fresh local Compose database. Compose publishes PostgreSQL on loopback port 55432 by default; the container still listens on port 5432. A host PostgreSQL service can keep port 5432. To use another host port, update POSTGRES_PORT and both runtime database URLs in `.env`, plus all three operator database URLs in `.env.operator`, together. Existing `.env` files retain their configured ports; changing the examples does not update them. Explicit shell settings override file values, so check for an exported POSTGRES_PORT if Compose still tries the old port. If you prefer an existing PostgreSQL server outside Compose, point all connections at it instead. Changing POSTGRES_USER/PASSWORD does not change credentials inside an existing persistent volume. The operator must have permission to create roles and grant ownership/capabilities. Replace all fictional passwords before using real participants or external services. URL-encode database usernames/passwords inside connection URLs.

The local launcher reads `.env`, then reads `.env.operator` only for operator commands. Explicit shell settings override file values. It strips managed settings for other roles before spawning a child. The worker receives WORKER_DATABASE_URL as its DATABASE_URL; migrations receive MIGRATOR_DATABASE_URL as DATABASE_URL. No fallback to the web connection is allowed for those commands. The web never reads the operator file or receives the worker URL. Production/container entrypoints can receive their own scoped process environment directly; this local convenience does not combine production secrets.

The previous `.env.worker`, `.env.maintenance`, `.env.migrations`, `.env.live-operator`, `.env.discord-registration` and `.env.discord-proxy` files are no longer loaded. Move their settings into the two files below; keep a private backup until the consolidated setup is verified. Do not source `.env.operator` globally in a shell.

## Runtime settings

The example lists every supported local runtime key. Its defaults are for a fresh loopback Compose setup, not a copy of private live credentials or workstation ports. Tests check the example against the launcher inventory and server configuration fields.

| Settings                                                               | Purpose                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APP_DISPLAY_NAME, APP_ORIGIN, PORT, WEB_HOST                           | Branding and web listener. Local WEB_HOST stays 127.0.0.1. APP_ORIGIN must match the browser origin and OAuth console callbacks.                                                                                                      |
| WORKER_HOST, WORKER_PORT                                               | Private worker health listener.                                                                                                                                                                                                       |
| COMPOSE_PROJECT_NAME, POSTGRES_PORT, POSTGRES_DB                       | Isolated local infrastructure. Database URLs must point to the same database/port.                                                                                                                                                    |
| DATABASE_URL, WORKER_DATABASE_URL, QUEUE_SCHEMA                        | Distinct restricted web and worker logins; pre-created worker queue schema.                                                                                                                                                           |
| MAIL_HTTP_PORT, MAIL_SMTP_PORT                                         | Local Mailpit UI and SMTP listeners. These do not configure Brevo.                                                                                                                                                                    |
| SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE | Mail transport shared by web and maintenance. Brevo submission uses port 587 with SMTP_SECURE=false for STARTTLS and an exact verified SMTP_FROM; port 465 uses true for implicit TLS. Local Mailpit uses 1025 and no authentication. |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI            | Configure all three or leave all blank. Exact callback: APP_ORIGIN/api/auth/google/callback.                                                                                                                                          |
| DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI         | Browser OAuth; configure all three or leave all blank. Exact callback: APP_ORIGIN/api/auth/discord/callback.                                                                                                                          |
| DISCORD_PUBLIC_KEY                                                     | Discord interaction signature verification; independent of browser OAuth.                                                                                                                                                             |
| DISCORD_PROXY_PORT, DISCORD_PROXY_TARGET                               | Loopback-only Discord POST proxy. Blank target follows APP_ORIGIN; set a target only for an intentional override. Tunnel the proxy, not the website.                                                                                  |
| REPORTING_TIMEZONE                                                     | Server-owned timezone for new challenge attempts.                                                                                                                                                                                     |
| LOG_FORMAT                                                             | auto, pretty or json. Developer/operator logs include redacted exception details; browser messages stay friendly.                                                                                                                     |
| TRUSTED_PROXY_HEADER, TRUSTED_PROXY_HOPS                               | Leave blank/zero unless a protected ingress overwrites the selected header.                                                                                                                                                           |
| OUTBOX_POLL_MS, OUTBOX_IDLE_MAX_MS                                     | Worker active batching and maximum failure backoff, in milliseconds.                                                                                                                                                                  |
| CONTACT_EMAIL                                                          | Optional published legal/contact address.                                                                                                                                                                                             |
| LIVE_TEST_EMAIL                                                        | Optional owner-controlled recipient for explicitly requested delivery checks. Never used by normal startup.                                                                                                                           |

On Windows/WSL, if a web port is reserved, choose an unreserved one and update PORT, APP_ORIGIN, both callbacks and their console registrations. The tracked example retains portable defaults; private port differences are intentional. Restart web, worker and maintenance after changing shared settings. If DISCORD_PROXY_TARGET is blank, it follows the new APP_ORIGIN on proxy restart.

## Operator settings and commands

| Settings                                                                                               | Purpose                                                                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| POSTGRES_USER, POSTGRES_PASSWORD                                                                       | Local Compose database bootstrap login; kept out of app processes.                   |
| OPERATOR_DATABASE_URL                                                                                  | Role/grant provisioning only.                                                        |
| MIGRATOR_DATABASE_URL                                                                                  | Connection owning tracker schema/migrations.                                         |
| ERASURE_DATABASE_URL                                                                                   | Restricted maintenance login with the erasure capability and account-mail access.    |
| MIGRATOR_DB_USER/PASSWORD, WEB_DB_USER/PASSWORD, WORKER_DB_USER/PASSWORD, MAINTENANCE_DB_USER/PASSWORD | Provisioned login definitions. Keep them consistent with their connection URLs.      |
| DISCORD_BOT_TOKEN, DISCORD_GUILD_ID                                                                    | Guild registration only; the matching application ID is DISCORD_CLIENT_ID in `.env`. |

```sh
pnpm database:provision roles
pnpm database:migrate
pnpm database:provision grants
pnpm accounts:maintain       # One sweep; may send mail and erase due owner-confirmed accounts
pnpm accounts:schedule      # One sweep each minute, without overlap
pnpm discord:register       # Dry-run; does not write to Discord
pnpm discord:register --apply # Register only in the configured guild
pnpm discord:proxy          # Exact POST /api/discord only
```

Registration remains an explicit write. Keep Discord's bot token out of web OAuth configuration. `--global` selects global commands only when deliberately requested. For direct automation/container entrypoints, supply DATABASE_URL to migrations/worker and ERASURE_DATABASE_URL to maintenance without the local launcher. Provisioning and registration use their named settings directly.

## Verification and diagnostics

`pnpm check` includes tests for example inventory drift, fictional role/URL consistency, credential scoping and secret redaction. CLI failures show the operation, recognized error code, redacted exception/stack/cause chain and a next step. For example, ECONNREFUSED points to database connectivity; 42501 points to role privileges. Arbitrary PostgreSQL query/detail fields are excluded. User-facing browser errors remain generic and request IDs correlate them with server logs.

Tests use process configuration, not the live `.env`: TRACKER_TEST_DATABASE_URL must select an isolated `_test` or `_ci` database. Restricted smoke additionally uses DATABASE_URL for web, SMOKE_WORKER_DATABASE_URL for worker and QUEUE_SCHEMA. SMOKE_STARTUP_TIMEOUT_MS and SMOKE_REQUEST_TIMEOUT_MS configure bounded timing allowances. Playwright uses QA_BASE_URL, QA_MAILPIT_URL, QA_BROWSER_OUTPUT, optional QA_CHROMIUM_EXECUTABLE and QA_VISUAL_OUTPUT; these are verification-only settings and are intentionally outside the two setup examples. Backup/restore settings remain operator-specific in [deployment](deployment.md).

Run [Playwright acceptance](../CONTRIBUTING.md#browser-regression-suite) after relevant UI, routing, authentication or frontend configuration changes. Capture synthetic screenshots with QA_VISUAL_OUTPUT outside the repository and inspect them alongside assertions. Review affected routes in both themes and at phone, tablet and desktop sizes when the change affects layout. Screenshots supplement behavior, accessibility, CSP and console checks; they do not replace them. Never capture owner accounts, reports, private emails or tokens in shared artifacts.

The web launcher prints `Open website` with the effective APP_ORIGIN. Use that
address instead of Next's listener address for browser sign-in. A loopback
hostname or port change also requires updating the exact redirect URI registered
for each OAuth client in its provider console; changing local configuration alone
does not update those registrations.

## Sleeping workers and PaaS

See [elastic hosting](elastic-hosting.md) before enabling request mode.

| Settings                                      | Purpose                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| WORK_MODE                                     | resident owns timers; request requires durable external scheduling.                                 |
| WORKER_WAKE_URL, WORKER_WAKE_SECRET           | Optional private projection-worker wake destination and independent 64-character hex signing key.   |
| MAINTENANCE_WAKE_URL, MAINTENANCE_WAKE_SECRET | Optional private account-maintenance wake destination and distinct signing key.                     |
| MAINTENANCE_HOST, MAINTENANCE_PORT            | Private maintenance listener; loopback:3002 by default.                                             |
| WORK_RECOVERY_MIN_MS, WORK_RECOVERY_MAX_MS    | Empty/future-work recovery backoff; defaults fifteen minutes to one hour.                           |
| HOUSEKEEPING_MIN_MS, HOUSEKEEPING_MAX_MS      | Adaptive housekeeping bounds; defaults one to twenty-four hours, overridden by retention deadlines. |
| DB_POOL_MAX, DB_CONNECT_TIMEOUT_MS            | Per-pool maximum connections (5) and cold connection timeout (15000 ms).                            |

Signing keys confer only permission to request a scan. Only the maintenance process
receives erasure credentials. Each worker receives only its own wake key. Routine
health checks must use liveness endpoints to allow PostgreSQL suspension.
