# ADR 0001: TypeScript modular monolith

Status: Accepted, 2026-10-06. Supersedes the initial proposed status following approval of the implementation plan.

## Decision

Use TypeScript, Next.js for browser/API/Discord HTTP interactions, PostgreSQL through Drizzle, Zod contracts, and an independent pg-boss worker. Use pnpm workspaces and Node 24. Adapters authenticate/validate; framework-independent core services authorize and transact; repositories persist. Web and Discord use identical commands. Completion is synchronous and independent of worker availability.

Boundaries: `apps/web`, `apps/worker`, `packages/contracts`, `packages/core`, `packages/db`. Inject clocks and date resolution. Persist UTC instants and SQL local dates. Only repositories/migrations access domain tables; the worker may access its own queue through pg-boss. Shared migrations/contracts have one integration owner.

Artwork is developed on a separate feature branch. It consumes versioned private core projections and cannot mutate completion truth. v0.1 has no renderer, art route/UI/job/storage dependency. Generic seed, source-revision and entitlement prerequisites belong to core.

## Alternatives and consequences

Separate services introduce unnecessary distributed consistency and operational costs; framework-coupled domain code prevents adapter parity tests. A modular monolith keeps transaction boundaries local while allowing a separate worker and future renderer. Package boundaries and real PostgreSQL concurrency tests remain mandatory. Hosting is deliberately gated separately from local development.

## Implementation evidence

See the root README for the actual skeleton commands and pinned dependencies. Feature plans are requirements, not proof of implemented behavior.
