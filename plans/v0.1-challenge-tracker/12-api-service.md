# Shared API and service contracts

Status: requirements accepted; feature implementation not started. Owner role: Contract/integration owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

One service API enforces authorization, lifecycle and transaction invariants for both adapters.

Dependencies/gates: F1 freeze; depends on accepted 02–09 rules, not their completed implementation.

## Contracts and behavior

Commands: StartAttempt, Enroll, CancelEnrollment, ResumeEnrollment, RestartAttempt, SaveGoal, SaveMilestone, ArchiveGoal/Milestone, SubmitReport, EditReport, Issue/RevokeCorrectionGrant, CorrectReport; admin Create/PublishSeason, SetSeasonFeatured and SaveSeasonTemplate. Identity link/unlink stays in authentication service. Queries: seasons/progress/reports/history/revisions/perks and metadata-only admin stats. Future DeleteArtwork/Reroll are absent from v0.1 endpoints. /api/v1 DTOs never accept authoritative userId/seed/mode/date. Errors: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION, VERSION_CONFLICT, ALREADY_REPORTED, ATTEMPT_CLOSED, SEASON_UNAVAILABLE, SEASON_SLOT_OCCUPIED, MILESTONE_LOCKED, GRANT_INVALID, RATE_LIMITED, IDEMPOTENCY_CONFLICT.

## Implementation tasks

- [x] Implement Zod command schemas, safe result/owner/admin DTOs and deterministic fictional fixtures before adapter work.
- [ ] Use actor+command+idempotency key with request hash and safe result reference in same transaction; default 30-day retention.
- [ ] Reauthorize replay; mismatched payload rejects; never store raw text in replay records/outbox.
- [ ] Implement stable cursor pagination, CSRF for cookie mutations, payload/rate limits and version conflicts.

## Acceptance criteria

- Rollback writes no partial result or idempotency record; expired retry retention still respects uniqueness/version constraints.
- Unauthorized lookups reveal no private text or seeds; metadata DTOs cannot accidentally serialize full entities.
- User-first lock order prevents slot/report/restart deadlocks; bounded retries preserve command identity.

## Progress, risks and evolution

F1 command registry covers all planned v0.1 tracker mutations. Safe result references, metadata events, owner/admin projections, private source schema and deterministic fixtures are implemented; the lifecycle matrix is in `docs/lifecycle.md`. Workspace checks and production build validate the package boundary. Transactional replay, pagination, adapters and domain enforcement remain F2/F3 work. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
