# Discord guild convenience adapter

Status: local implementation verified; external release gates remain. Owner role: Discord owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Signed HTTP guild interactions and private responses; no gateway or message scraping.

Dependencies/gates: F1 fixtures; F3 service parity; E-Discord only for live registration.

## Contracts and behavior

Commands cover join/setup/update/edit/progress/goals/milestones/streak/perks/seasons/cancel/resume/restart. Use modals and private links for complex history/linking. Unknown Discord identity receives a secure web account/link flow, never email matching. No DM commands in v0.1. Interaction ID is idempotency key. Verify raw-body Ed25519 signature, timestamp freshness and replay behavior before dispatch.

## Implementation tasks

- [x] Define command payloads/response fixtures; validate against current official Discord protocol.
- [x] Implement signed fixture tests, private modals and actor-bound expiring confirmations.
- [x] Defer slow responses within official deadlines; delivery failure cannot undo domain success.
- [ ] After portal setup register guild commands and perform live signature/OAuth smoke tests.

## Acceptance criteria

- Forged/stale signatures reject before domain access; retries cannot duplicate reports or restarts.
- Same commands match web outcomes; guild membership is not a web authorization prerequisite.
- No log text in public replies/logs; suppress mentions and reject another user’s confirmation.

## Progress, risks and evolution

Signed guild fixtures validate the current official interaction protocol, private deferred replies/modals, forged/stale signature rejection, DM rejection, expired and cross-account form rejection, command parity and duplicate report/setup/resume delivery. Failed private delivery leaves domain success intact. A duplicate signed resume reuses its original version. Actor-bound form metadata is migration 3; no report bodies or interaction tokens are retained there. The command manifest is exported without remote registration. Live guild installation remains E-Discord.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
