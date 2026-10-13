# Contributing

These practices apply to individual and collaborative development from any repository checkout.

## Architecture and source layout

Consult [architecture decisions](docs/adr/README.md) and [domain rules](docs/domain.md) before changing shared behavior. The [modular monolith decision](docs/adr/0001-modular-monolith.md) defines these boundaries:

| Location             | Responsibility                                      |
| -------------------- | --------------------------------------------------- |
| `apps/web`           | Browser UI, API, and Discord adapter                |
| `apps/worker`        | Notifications and maintenance                       |
| `packages/contracts` | Shared schemas, commands, results, and typed errors |
| `packages/core`      | Authorization and domain services                   |
| `packages/db`        | Database schema, repositories, and migrations       |

The local tracker implements these package boundaries; live service and release evidence remains gated. Inspect the active checkout's manifests, configuration, component documentation, and CI for setup and verification commands. Check official documentation when selecting dependency versions or implementing external protocols.

Adapters authenticate and validate; domain services authorize and enforce lifecycle rules; repositories persist. Coordinate shared contracts and migration changes before dependent work, and review their combined effect during integration. Domain services must remain independent of web and Discord framework types.

## Branching and review

- Use `develop` as the integration baseline and feature/fix PR target. Promote validated releases from `develop` to `main`. Preserve both long-lived branches.
- Use focused topic branches, such as `feat/<topic>` or `fix/<topic>`, and Conventional Commits: `type(scope): imperative description`.
- Keep experimental work separate until its integration is approved against the applicable scope and acceptance criteria.
- Inspect status and the intended baseline before beginning work. Coordinate overlapping changes and preserve others' contributions.
- Follow existing PR templates. Describe the concrete problem, resulting behavior, useful implementation details, verification, material risks, and coverage gaps. Anchor review findings to relevant code and recommend actionable fixes.
- Avoid rewriting shared history without agreement. Prefer safe branch deletion after verifying integration and recoverability.

## Verification and parallel development

Run commands from the checkout that owns the change. Use checks defined by project configuration and CI; run relevant focused checks and required aggregate checks. Do not claim checks ran when tools or services were unavailable.

Test behavior and contracts with deterministic clocks and fictional fixtures. Relevant coverage includes reporting dates across gaps and timezone transitions, duplicate submissions, restart/completion races, rollback, stable completion records, adapter parity, and worker retries. Use real PostgreSQL for constraints, migrations, locking, and transaction tests. UI changes require appropriate accessibility and interaction verification. Documentation-only edits require content, formatting, and link checks. Investigate flaky failures rather than repeatedly rerunning for a pass.

Concurrent checkouts or stacks must have independent ports, database names, container/Compose project names, worker queues, environment files, caches, and outputs. Discover supported configuration rather than inventing variable names. Verify database and queue targets before starting services; one stack's worker must not consume another's jobs. Apply competing migrations to separate disposable/local databases, not a shared development database. Keep test data separate from participant data.

## Code documentation

Use JSDoc for code documentation throughout the project. Write for a developer using the symbol: explain what it provides, when to use it, and how to use it. A short description may answer all three; prefer useful, concise prose over a fixed template.

- Document every exported function, value, type, default export, and publicly accessible returned member. Include meaningful failure behavior, resource ownership, required cleanup, and notable side effects such as I/O, data changes, logging, or starting processes.
- Use parameter, return, and error descriptions when they clarify the contract. Avoid repeating TypeScript types or requiring examples for obvious usage.
- Give executable modules file-level JSDoc describing purpose, invocation, prerequisites, and side effects, including any work performed immediately when executed or imported.
- Give private helpers and meaningful module-level constants shorter JSDoc. Routine local variables and anonymous callbacks do not need documentation.
- Keep implementation details and notes for future contributors in ordinary inline comments, outside JSDoc. Public documentation describes observable behavior and caller responsibilities rather than internal algorithms or storage choices.
- Update documentation with behavior changes. Review it against actual commands and side effects; exclude generated declarations, build output, dependencies, and files whose format cannot contain JSDoc.
- For documentation-only edits, verify executable syntax is unchanged and run formatting, lint, and documentation-link checks. Documentation does not require new behavioral tests or tooling dependencies.

## Security and documentation

Enforce resource authorization, safe response projections, and explicit confirmation for destructive user operations. Never commit credentials, tokens, private report bodies, real participant fixtures, or machine-specific environment files. Redact sensitive content in logs and keep private session details out of public issues, reviews, and PRs.

Use [directory READMEs](plans/README.md) to discover current planning groups. Record durable architecture decisions in ADRs and lasting behavioral requirements in domain documentation. Plans may be cleaned up; documentation needed to maintain the project must survive that cleanup. Keep developer guidance here rather than duplicating it in agent instructions.

## Local setup

Requirements: the runtime and package manager specified in [package.json](package.json), plus Docker Compose (or compatible Podman Compose).

Check `node --version` before starting commands. The repository's `.nvmrc` selects
Node 24; with nvm run `nvm use`. With mise, run commands through
`mise exec node@24 -- pnpm dev:worker` (or the desired pnpm command). Installing
Node 24 does not change an existing shell's active Node version. Local launchers
reject unsupported versions before loading application code; authentication uses
Node 24's built-in Argon2 support.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
cp .env.operator.example .env.operator
chmod 600 .env .env.operator
pnpm services:up
pnpm database:provision roles
pnpm database:migrate
pnpm database:provision grants
pnpm dev:web
```

After [restricted role setup](docs/deployment.md), set DATABASE_URL and WORKER_DATABASE_URL in .env to their separate restricted logins and use the matching queue schema. See the [two-file configuration guide](docs/configuration.md). In a second terminal run `pnpm dev:worker`. Open http://localhost:3000 and Mailpit at http://localhost:8025. PostgreSQL binds to loopback port 55432 by default, leaving port 5432 available for a host PostgreSQL service. Mailpit is a local mailbox; no email is sent to external recipients. `pnpm services:up` uses detached startup and waits up to 120 seconds for both container health checks, supporting Docker Compose and Podman Compose without requiring `up --wait`. If startup fails, inspect `docker compose ps` and `docker compose logs`. `pnpm services:down` stops services without deleting the database volume.

The web landing page and liveness endpoints also run without `.env` or services. Readiness returns 503 until a database is configured. If DATABASE_URL is set, the resident worker checks migrations at startup and fails clearly if unavailable. Apply the tracked migrations with `pnpm database:migrate`, which selects MIGRATOR_DATABASE_URL from ignored .env.operator, before supplying the restricted web connection. Operator commands receive only their required settings; web and worker never read this file. The worker queue schema is pre-created by provisioning. Auth provider settings may remain blank; no fake login or development authentication bypass is installed. See [authentication and privacy](docs/authentication.md) for runtime/operator role separation.

For concurrent checkouts use unique COMPOSE_PROJECT_NAME, POSTGRES_DB, POSTGRES_PORT, PORT, WORKER_PORT, QUEUE_SCHEMA and Mailpit ports in separate ignored `.env` files. Update DATABASE_URL to match that checkout's database and port. Never point smoke tests or experimental workers at participant databases.

## Commands and boundaries

| Command                                | Purpose                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm check`                           | Typecheck, lint/boundaries, formatting, document links/vector and unit tests             |
| `pnpm build`                           | Compile packages/worker and build production Next.js                                     |
| `pnpm smoke`                           | Start built web/worker on temporary ports; verify page, branding, liveness and readiness |
| `pnpm format`                          | Format source and documentation                                                          |
| `pnpm start:web` / `pnpm start:worker` | Run production builds with scoped web/worker connections from `.env`                     |

Run build before smoke/start. Without DATABASE_URL, smoke verifies readiness is unavailable; with an isolated database it verifies connectivity and durable-worker readiness. Set TRACKER_TEST_DATABASE_URL to a disposable database ending in `_test` or `_ci` to run the transaction/adapter/worker suite; absent configuration explicitly skips those tests. CI supplies PostgreSQL, provisions actual restricted logins, migrates as the migrator and runs the real suite, build and smoke. `GET /api/health` and worker `GET /health` are liveness; `/api/ready` and worker `/ready` require database connectivity. Readiness also requires all applied tracker migrations; the worker checks them before handlers start. See the [operations runbook](docs/operations.md).

`apps/web` owns the browser/API adapters; `apps/worker` owns async execution. `packages/contracts` owns transport schemas, `packages/core` framework-independent services and `packages/db` persistence. Shared packages compile before app development; rerun their build after editing their sources. The guidance above describes coordination and verification.

## Containers

```sh
docker build --target web -t challenge-web .
docker build --target worker -t challenge-worker .
```

Images run as a non-root user and contain the verified workspace build. The web image uses Next standalone output; the worker uses a production-only workspace package. The private maintenance image retains the toolchain for its scheduled operator script. Supply runtime environment and database networking explicitly; local `.env` and credentials are excluded from the build context. Containers do not provision hosting or run domain migrations.

Dependency choices were checked against official [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [pnpm installation](https://pnpm.io/installation), [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [Zod](https://zod.dev/) and [pg-boss](https://pgboss.io/introduction) documentation. Exact versions live in manifests and lockfile; Node 24 meets Next.js and pg-boss runtime requirements.

## Browser regression suite

Install the runner's Chromium with `pnpm exec playwright install chromium` (see [Playwright browser setup](https://playwright.dev/docs/browsers)). Start a production build against an isolated database and set QA_BASE_URL and TRACKER_TEST_DATABASE_URL before `pnpm test:browser`. The database name must end in `_test` or `_ci`; fixtures create fictional users and seasons. QA_BROWSER_OUTPUT selects an external artifact directory (defaults to the system temporary directory). If the host requires an already-installed compatible Chromium, supply QA_CHROMIUM_EXECUTABLE explicitly. Tests run without retries. For affected frontend/authentication/configuration changes, set QA_VISUAL_OUTPUT to an external synthetic artifact directory, capture both themes and relevant viewport sizes, and inspect the screenshots alongside behavior/accessibility/CSP checks. Never capture private owner data.

Avatar uploads use Sharp's default metadata stripping, resize and explicit WebP output; see [Sharp output behavior](https://sharp.pixelplumbing.com/api-output/). Keep decoding and pixel limits server-side.

## Documentation conventions

Describe behavior and link to the manifest, configuration or source that owns a changing value. Keep versions, test totals and dated pass/fail results in explicitly historical verification records. Preserve normative domain and security limits. Provider pricing and quotas belong in provider documentation.

Read [the design brief](docs/design.md) and the frontend-design skill before UI changes. [Live testing](docs/live-testing.md) describes private local OAuth and the Discord-only tunnel. This owner-authorized hardening initiative works on main; local develop was fast-forwarded to its starting point. Future contribution defaults above still apply.

## Source structure and readability

Keep handwritten production TypeScript, JavaScript and CSS files at 300 physical
lines or fewer, including comments and blank lines. Generated output, dependencies
and declarations are excluded. Tests have no strict ceiling; group them by feature
when this improves maintenance. Preserve package exports through small facades and
keep transaction ownership and private projections explicit.

Use one blank line after completed blocks/declarations and multiline statements
when another sibling statement follows. Keep else/catch/finally chains, switch cases
and closing delimiters together. Internal object, argument and array spacing stays
discretionary. `pnpm format` applies Prettier and AST-aware statement spacing;
`pnpm source:check` enforces spacing and production file limits. Aggregate typechecking also checks operational TypeScript scripts.

Keep Tailwind semantic utilities and global tokens/resets/document defaults. Put
bespoke component styles in CSS Modules, preserving cascade layers and responsive
behavior. Browser tests should locate accessible controls or stable state attributes
rather than depend on generated class names.

Maintain the modular YAML OpenAPI source with `pnpm openapi:lint`; see the
[reference guide](docs/reference/README.md) for external bundle output.

## Compatibility and release acceptance

Follow [MVP compatibility](docs/compatibility.md) when changing contracts, domain
behavior or storage. Applied migrations are immutable; append corrective
migrations and test upgrades on populated disposable data. Preserve existing
clients and participant history; explicitly review versioned breaking interfaces
and any required data transition. Keep database/OpenAPI references aligned with
runtime behavior. Close the [hosted pilot checklist](docs/pilot-readiness.md) before
additional users; local fixtures do not establish hosted provider or restore
acceptance.

The browser suite requires fictional enabled Google and Discord configuration
with callback URLs on QA_BASE_URL, as supplied by the browser CI step. The OAuth
scenario intercepts external navigation and never uses real provider accounts.
Use a disposable database and SMTP catcher for this configuration; retain the
separate provider-disabled startup and bootstrap regressions.

Sleeping worker execution and elastic-hosting constraints are documented in [ADR 0003](docs/adr/0003-idle-workers.md) and [elastic hosting](docs/elastic-hosting.md).
