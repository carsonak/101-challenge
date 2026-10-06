# Verification and release evidence

Status: local implementation verified; external release gates remain. Owner role: Test/integration owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Separate foundation evidence from required future feature acceptance.

Dependencies/gates: F0 checks now; F1 fixtures; F2/F3 domain integrations later.

## Contracts and behavior

Use deterministic clocks, fictional participants and actual PostgreSQL for constraints/locking. Test Nairobi and a DST zone; fixture states 0/1/100/101 reports, sparse 101 dates, separate seven-day runs, cancelled/resumed and progress-only attempts.

## Implementation tasks

- [x] Run workspace install/type/lint/unit/build and web/worker smoke checks for foundation.
- [x] Add two-connection races for season slot, completion/restart, milestone/report, correction expiry and one-use keys.
- [x] Test email and OAuth linking, cookie CSRF, signed Discord fixtures and adapter parity.
- [x] Verify admin/private/public DTO boundaries, same-day final-report editing, retained history and rollback.
- [ ] Perform live provider smoke tests, staging load trial (100 participants/10 concurrent writes), restore and erasure replay before release.

## Acceptance criteria

- 101 reports may span >101 days; no duplicated counts or completion; all attempt history survives restart.
- Correction changes source without log-history retention; reroll grants are unique by earning report.
- v0.1 contains no artwork runtime; separate artwork suite covers determinism, credit spending and stale publication.

## Progress, risks and evolution

The complete local suite passes 29 tests with PostgreSQL enabled and no skips. Coverage includes clean migrations, slots/restart/completion/milestone/one-use races, exact grant/proof expiry boundaries, sparse 101 dates, final-day editing, retained facts/history, rollback, independent authentication/linking, cookie CSRF, provider proof validation, signed guild parity, privacy/erasure and worker recovery. Production-browser verification uses fictional accounts and a separate local SMTP catcher. Worker maintenance/retry scenarios each create and remove a separate disposable database. Final production build/smoke evidence is recorded in the root README. Live provider/load/production restore checks remain unchecked.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
