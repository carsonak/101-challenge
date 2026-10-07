# QA implementation overview

Implemented against reviewed main commit `fd1af95`. The user subsequently authorized committing, merging into main and pushing the verified result. The older develop branch is not the implementation baseline.

- [x] [Phase 1: Shared UI and authentication](phase-1.md)
- [x] [Phase 2: Profiles, security and recoverable deletion](phase-2.md)
- [x] [Phase 3: Season administration and setup](phase-3.md)
- [x] [Phase 4: Lifecycle and historical corrections](phase-4.md)
- [x] [Phase 5: Home, notifications, logging and documentation](phase-5.md)

The [47-item mapping](checklist.md) preserves the original recommendations. The unfinished Home item is consolidated into QA-45. Checkmarks cover the agreed application scope, with the release boundaries below.

## Verification

Verified on 2026-10-07 using isolated PostgreSQL 17, Mailpit and Chromium:

- `pnpm check`: typechecking, lint, formatting, documentation checks and all 41 tests passed; no skipped tests. Includes fresh installation and upgrade from migrations 1–4, username races, deletion deadline/recovery, retained history and the 101st historical reporting date.
- `pnpm build`: production packages, worker and Next.js application passed.
- `pnpm test:browser`: all six scenarios passed against the production build. Covers authentication/verification/reset, account recovery, season setup/lifecycle, avatars, inbox, navigation, themes/mobile interaction and backfill.
- `pnpm smoke`: passed both with an isolated database and without database configuration (readiness correctly unavailable).
- Explicit pretty/JSON diagnostic output checks passed; production redirected output remains JSON and private fields/error messages stay excluded.
- `pnpm format` applied the repository formatter; final `pnpm lint`, `pnpm format:check`, `pnpm docs:check` and `git diff --check` all passed.

The local operating system is unsupported by this Playwright version's Chromium installer, so the suite used an already installed compatible Chromium executable through the documented configuration override. Next.js subprocess checks and local-service tests ran with the required sandbox permissions. No checks are represented as live-provider or production verification.

## Release boundaries and operator handoff

Live Google/Discord configuration, production email delivery and deployment were not performed. Local provider doubles and Mailpit verify implementation. Schedule the privileged account-maintenance process described in [operations](../../docs/operations.md) before enabling scheduled account deletion in a deployment; privileged erasure credentials must remain outside the web runtime. Historical published seasons without trustworthy evidence require an explicit administrator publication timestamp before backdating.

Artwork rendering and concrete perk benefits remain in the separate artwork release; this work updates lifecycle/source contracts and reserves Home integration without displaying nonexistent artwork. Git integration is authorized separately from production deployment.
