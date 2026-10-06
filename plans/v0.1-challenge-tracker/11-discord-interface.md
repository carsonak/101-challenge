# Discord guild convenience adapter

Status: requirements accepted; feature implementation not started. Owner role: Discord owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Signed HTTP guild interactions and private responses; no gateway or message scraping.

Dependencies/gates: F1 fixtures; F3 service parity; E-Discord only for live registration.

## Contracts and behavior

Commands cover join/setup/update/edit/progress/goals/milestones/streak/perks/seasons/cancel/resume/restart. Use modals and private links for complex history/linking. Unknown Discord identity receives a secure web account/link flow, never email matching. No DM commands in v0.1. Interaction ID is idempotency key. Verify raw-body Ed25519 signature, timestamp freshness and replay behavior before dispatch.

## Implementation tasks

- [ ] Define command payloads/response fixtures; validate against current official Discord protocol.
- [ ] Implement signed fixture tests, private modals and actor-bound expiring confirmations.
- [ ] Defer slow responses within official deadlines; delivery failure cannot undo domain success.
- [ ] After portal setup register guild commands and perform live signature/OAuth smoke tests.

## Acceptance criteria

- Forged/stale signatures reject before domain access; retries cannot duplicate reports or restarts.
- Same commands match web outcomes; guild membership is not a web authorization prerequisite.
- No log text in public replies/logs; suppress mentions and reject another user’s confirmation.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
