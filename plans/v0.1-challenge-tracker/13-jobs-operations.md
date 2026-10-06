# Worker and operations

Status: local implementation verified; external release gates remain. Owner role: Operations owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

pg-boss handles housekeeping, outbox delivery and projection checks. No art jobs in v0.1.

Dependencies/gates: F0 local worker; F1 event schema; external transports only at delivery gates.

## Contracts and behavior

Events contain eventId/type/schemaVersion/aggregateId/sourceVersion/occurredAt and safe IDs only. Workers reload state; source revisions and cancellation neutralize stale work. Cleanup covers sessions, correction grants and idempotency retention. Reminders are deferred beyond v0.1 rather than requiring notification preferences and a live provider to release.

## Implementation tasks

- [x] Build worker lifecycle, database readiness and shutdown before registering handlers.
- [x] Add outbox publisher, retry/backoff limits and terminal failure inspection.
- [x] Implement idempotent housekeeping and projection checks; keep completion synchronous.
- [x] Write redaction, restore/deletion-ledger and incident runbooks.

## Acceptance criteria

- Crash between commit/publish or publish/mark recovers without duplicate logical effects.
- No private body/token/seed in logs or event payloads.
- Queue outage leaves reporting available; stale source jobs cannot overwrite newer state.

## Progress, risks and evolution

Migration 4 adds delivery leases, receipt deduplication and content-free current projections. Real isolated PostgreSQL/pg-boss tests cover queue outages, publish-before-mark crashes, duplicate receipt processing, stale source events, repeated housekeeping and two workers. Application readiness requires all migrations; worker cleanup is installed before registering handlers. Erasure tests remove forms/projections/receipts and ignore a subsequently replayed erased event. Redaction, retention, terminal inspection and restore/incident procedures are in `docs/operations.md`; production restore infrastructure remains an external gate.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
