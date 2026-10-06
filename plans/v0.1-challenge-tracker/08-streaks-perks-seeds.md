# Streaks, reroll credits and private seeds

Status: local implementation verified; external release gates remain. Owner role: Domain owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Persist generic deterministic inputs and credits; defer tile selection and spending to artwork runtime.

Dependencies/gates: F1 source fixture agreement; report/milestone facts.

## Contracts and behavior

Generate private participant and season entropy once. Derive per-attempt base seed using versioned HMAC-SHA-256/canonical initial input encoding; keep seeds server-only. Canonical source specification lives in the artwork contract plan. Track current/longest streak by local date. Grant one credit on each multiple of seven in a consecutive run; unique earningReportId + ruleVersion prevents duplicate grants while allowing a later seven-day run. Credits survive gaps and cancellation; expire only on restart. Cancelled attempts cannot spend credits; resumption preserves their remaining balance. Catalog initially contains only streak reroll, selected by default; no monetary/external rewards.

## Implementation tasks

- [x] Implement pure streak functions with injected dates.
- [x] Persist initial seed inputs and derivation version atomically at start; expose no seed in owner/admin projections.
- [x] Grant credits synchronously with reports; record balance without v0.1 spend endpoints.
- [x] Store versioned selected-perk/milestone/streak facts per accepted report for future backfill.

## Acceptance criteria

- Gaps reset current streak but preserve progress and longest streak.
- Retries grant once; two separate seven-day runs grant twice; restart expires balances while cancellation retains them.
- Goal edits preserve base seed; restarted attempts derive new seeds; private fields never reach transport DTOs.

## Progress, risks and evolution

Core lifecycle, setup/revisions, reporting/milestone locks, attempt-v1 seeds, streak credits, atomic completion and correction services are implemented. Deterministic unit tests and real PostgreSQL transaction/race tests provide domain evidence; browser/Discord integration and identity/privacy are verified at F3. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
