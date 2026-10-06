# Architecture

Status: foundation implemented and verified; domain features not started. Owner role: Foundation owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Use the accepted TypeScript modular monolith and pnpm package boundaries. No artwork runtime enters v0.1.

Dependencies/gates: F0; no external setup.

## Contracts and behavior

Clock and timezone ports belong in core; contracts contain Zod DTOs and typed errors; database package owns persistence. Environment validation is server-only and optional providers are disabled unless fully configured.

## Implementation tasks

- [x] Create executable web/worker entrypoints, shared package exports, workspace checks and CI.
- [x] Add local PostgreSQL/mail catcher, environment examples, production builds and health/readiness separation.
- [ ] Freeze F1 contracts with fixtures; implement enroll/setup/report/progress vertical slice before wider adapter integration.

## Acceptance criteria

- Install, typecheck, lint, tests and build run without provider credentials.
- Core/contracts import no Next.js, Discord or artwork code; a worker outage cannot prevent completion.

## Progress, risks and evolution

Foundation evidence: frozen installation, checks/build, and web/worker smoke with and without PostgreSQL passed; Mailpit health passed. No domain feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
