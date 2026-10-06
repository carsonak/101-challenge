# Shared API and service contracts

Status: local implementation verified; external release gates remain. Owner role: Contract/integration owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

One service API enforces authorization, lifecycle and transaction invariants for both adapters.

Dependencies/gates: F1 freeze; depends on accepted 02–09 rules, not their completed implementation.

## Contracts and behavior

Commands: StartAttempt, Enroll, CancelEnrollment, ResumeEnrollment, RestartAttempt, SaveGoal, SaveMilestone, ArchiveGoal/Milestone, SubmitReport, EditReport, Issue/RevokeCorrectionGrant, CorrectReport; admin Create/PublishSeason, SetSeasonFeatured and SaveSeasonTemplate. Identity link/unlink stays in authentication service. Queries: seasons/progress/reports/history/revisions/perks and metadata-only admin stats. Future DeleteArtwork/Reroll are absent from v0.1 endpoints. /api/v1 DTOs never accept authoritative userId/seed/mode/date. Errors: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION, VERSION_CONFLICT, ALREADY_REPORTED, ATTEMPT_CLOSED, SEASON_UNAVAILABLE, SEASON_SLOT_OCCUPIED, MILESTONE_LOCKED, GRANT_INVALID, RATE_LIMITED, IDEMPOTENCY_CONFLICT.

## Implementation tasks

- [x] Implement Zod command schemas, safe result/owner/admin DTOs and deterministic fictional fixtures before adapter work.
- [x] Use actor+command+idempotency key with request hash and safe result reference in same transaction; default 30-day retention.
- [x] Reauthorize replay; mismatched payload rejects; never store raw text in replay records/outbox.
- [x] Implement stable cursor pagination, CSRF for cookie mutations, payload/rate limits and version conflicts.

## Acceptance criteria

- Rollback writes no partial result or idempotency record; expired retry retention still respects uniqueness/version constraints.
- Unauthorized lookups reveal no private text or seeds; metadata DTOs cannot accidentally serialize full entities.
- User-first lock order prevents slot/report/restart deadlocks; bounded retries preserve command identity.

## Progress, risks and evolution

Contracts and transactional replay are implemented together with native HTTP adapters: exact-origin/session-CSRF checks, strict actor-derived commands, bounded payloads/rates, scoped UUID cursor pagination, safe errors and optimistic versions. PostgreSQL/browser fixtures verify replay, owner export, forged actor rejection and metadata-only administrator responses. Owner report projections carry the revision IDs frozen at acceptance, so later definition changes do not change the edit form. See `docs/lifecycle.md` and `apps/web/README.md`.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
