# Seasons and enrollment

Status: local implementation verified; external release gates remain. Owner role: Lifecycle owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Published seasons have optional recommended templates and community-session links. Users may enroll/cancel anytime.

Dependencies/gates: F1, identity and transactional repository interfaces.

## Contracts and behavior

Season states draft/published; published seasons remain enrollable, including past seasons. A featured flag controls discovery, not eligibility. One unfinished active season slot per user, retained enrollment per season. Enroll reserves that slot even before initial setup; StartAttempt submits goals and starts the clock. Cancelling an enrollment without an attempt also releases the slot. Cancellation marks current attempt cancelled and frees slot; resume reactivates that attempt after atomically acquiring slot. Completed-season restarts bypass slot but retain per-enrollment one-active-attempt constraint. No completed season permits a second entitlement.

## Implementation tasks

- [x] Implement admin publish/featured/template changes with metadata audit.
- [x] Implement enroll/start/cancel/resume and slot transfer rules with user-first locking.
- [x] Present optional recommended plan or custom goals; freeze enrollment timezone on first start.
- [x] Provide owner history and metadata-only admin queries.

## Acceptance criteria

- Two simultaneous new season starts allow one; cancellation/resume race cannot acquire two slots.
- Cancellation retains reports and resume preserves count; completed-season restarts can coexist with another season.
- Past published seasons remain enrollable; custom goals need no guild membership.

## Progress, risks and evolution

Core lifecycle, setup/revisions, reporting/milestone locks, attempt-v1 seeds, streak credits, atomic completion and correction services are implemented. Deterministic unit tests and real PostgreSQL transaction/race tests provide domain evidence; browser/Discord integration and identity/privacy are verified at F3. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
