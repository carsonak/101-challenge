# 101 Challenge

A challenge tracker tailored for BitDevs Kisumu, with independent web accounts and optional Discord convenience features. Participants work toward 101 reporting days at their own pace.

**Current state:** runnable foundation and accepted feature plans. Accounts, challenge tracking, domain migrations and artwork are not implemented yet. The landing page states this explicitly.

## Local setup

Requirements: Node 24, pnpm 10.34.6, Docker Compose (or compatible Podman Compose). Install pnpm with `npm install --global pnpm@10.34.6` if needed.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm services:up
pnpm dev:web
```

In a second terminal run `pnpm dev:worker`. Open http://localhost:3000 and Mailpit at http://localhost:8025. PostgreSQL binds to loopback port 5432. Mailpit is a local mailbox; no email is sent to external recipients. With Podman Compose versions without `--wait`, use `docker compose up -d` and inspect `docker compose ps` for healthy services. `pnpm services:down` stops services without deleting the database volume.

The web page and liveness endpoints also run without `.env` or services. Readiness returns 503 until a database is configured. If DATABASE_URL is set, the worker initializes pg-boss infrastructure at startup and fails clearly if unavailable. No domain migrations exist yet. Auth settings may remain blank; no fake login or development authentication bypass is installed.

For concurrent checkouts use unique COMPOSE_PROJECT_NAME, POSTGRES_DB, POSTGRES_PORT, PORT, WORKER_PORT, QUEUE_SCHEMA and Mailpit ports in separate ignored `.env` files. Update DATABASE_URL to match that checkout's database and port. Never point smoke tests or experimental workers at participant databases.

## Commands and boundaries

| Command                                | Purpose                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm check`                           | Typecheck, lint/boundaries, formatting, document links/vector and unit tests             |
| `pnpm build`                           | Compile packages/worker and build production Next.js                                     |
| `pnpm smoke`                           | Start built web/worker on temporary ports; verify page, branding, liveness and readiness |
| `pnpm format`                          | Format source and documentation                                                          |
| `pnpm start:web` / `pnpm start:worker` | Run production builds with root `.env`                                                   |

Run build before smoke/start. Without DATABASE_URL, smoke verifies readiness is unavailable; with an isolated database it verifies connectivity and worker queue initialization. CI supplies PostgreSQL and runs check, build and smoke. `GET /api/health` and worker `GET /health` are liveness; `/api/ready` and worker `/ready` require database connectivity. Future readiness also checks applied domain migrations.

`apps/web` owns the browser/API adapters; `apps/worker` owns async execution. `packages/contracts` owns transport schemas, `packages/core` framework-independent services and `packages/db` persistence. Shared packages compile before app development; rerun their build after editing their sources. [Contributor guidance](CONTRIBUTING.md) describes coordination and verification.

## Planning and gates

- [Tracker overview](plans/v0.1-challenge-tracker/OVERVIEW.md): local work first, external provider/hosting gates later.
- [Artwork overview](plans/artwork-generator/OVERVIEW.md): separate branch/release, starting with fictional fixtures.
- [Domain rules](docs/domain.md) and [architecture decisions](docs/adr/README.md): accepted policies.

`develop` is the integration branch, `main` the release branch, and `feat/artwork-generator` starts at the shared foundation. No renderer or art runtime ships in the tracker foundation. Google/Discord portals, production email, hosting and storage are unconfigured. Live provider setup and deployments follow their explicit gates, not local bootstrap.

## Containers

```sh
docker build --target web -t challenge-web .
docker build --target worker -t challenge-worker .
```

Images run as a non-root user and contain the verified workspace build. This initial portable image retains build dependencies; production image slimming is an operations follow-up. Supply runtime environment and database networking explicitly; local `.env` and credentials are excluded from the build context. Containers do not provision hosting or run domain migrations.

Dependency choices were checked against official [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [pnpm installation](https://pnpm.io/installation), [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [Zod](https://zod.dev/) and [pg-boss](https://pgboss.io/introduction) documentation. Exact versions live in manifests and lockfile; Node 24 meets Next.js and pg-boss runtime requirements. TypeScript remains on the compatible 5.9 line for this foundation.

## Foundation verification

Verified on 2026-10-06 with Node 24.18.0 and pnpm 10.34.6: frozen-lockfile installation, `pnpm check`, production build, and web/worker smoke checks both without database configuration and against isolated PostgreSQL 17.11. Mailpit 1.31.2 health also passed. The web container image built from a clean dependency install, and both non-root web/worker entrypoints passed HTTP smoke checks using that image. These checks verify the skeleton only; feature acceptance tests remain unchecked in the plans. Live OAuth/email delivery and deployment were not configured or tested.

## License and identity

Code and documentation use the unmodified [Apache-2.0 license](LICENSE). BitDevs Kisumu identity is reserved separately in [BRANDING.md](BRANDING.md). No logos or branded artwork assets are bundled. Set APP_DISPLAY_NAME to rebrand the displayed name. Participant text/artwork is not automatically licensed under the code license.
