# Worker and operations

Status: requirements accepted; feature implementation not started. Owner role: Operations owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

pg-boss handles housekeeping, outbox delivery and projection checks. No art jobs in v0.1.

Dependencies/gates: F0 local worker; F1 event schema; external transports only at delivery gates.

## Contracts and behavior

Events contain eventId/type/schemaVersion/aggregateId/sourceVersion/occurredAt and safe IDs only. Workers reload state; source revisions and cancellation neutralize stale work. Cleanup covers sessions, correction grants and idempotency retention. Reminders are deferred beyond v0.1 rather than requiring notification preferences and a live provider to release.

## Implementation tasks

- [ ] Build worker lifecycle, database readiness and shutdown before registering handlers.
- [ ] Add outbox publisher, retry/backoff limits and terminal failure inspection.
- [ ] Implement idempotent housekeeping and projection checks; keep completion synchronous.
- [ ] Write redaction, restore/deletion-ledger and incident runbooks.

## Acceptance criteria

- Crash between commit/publish or publish/mark recovers without duplicate logical effects.
- No private body/token/seed in logs or event payloads.
- Queue outage leaves reporting available; stale source jobs cannot overwrite newer state.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
