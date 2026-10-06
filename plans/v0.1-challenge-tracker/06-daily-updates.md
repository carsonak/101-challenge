# Reports and authorized corrections

Status: requirements accepted; feature implementation not started. Owner role: Reporting owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Today-only truthful reporting, same-day edits, and keyed historical corrections. No log revision history.

Dependencies/gates: F1, active attempt, goal revisions; 08/09 in the same transaction.

## Contracts and behavior

SubmitReport uses attemptId/body/goalValues/milestoneAchievements?/expectedAttemptVersion; milestoneAchievements contains only same-attempt manual milestone IDs whose target equals the new reporting index; server supplies date. EditReport uses reportId/body/goalValues/expectedReportVersion; server checks owner/local date. Body 1..4000 trimmed characters. A same-day 101st report may be edited after completion. All other closed-attempt or historical edits require a grant. Corrections only replace existing text/values, never date/count. Store latest body and timestamps only; bump sourceVersion, preserve frozen milestone facts for that reporting index, and emit metadata-only invalidation.

## Implementation tasks

- [ ] Lock user/enrollment/attempt, resolve clock once, enforce unique date and version checks.
- [ ] Update streak/perks/milestone facts and complete atomically at report 101.
- [ ] Implement scoped one-use and <=1h window grants; atomically validate/consume the grant with report update.
- [ ] Reject ordinary backdating and report deletion; retain inputs needed for future deterministic rendering without retaining old log bodies.

## Acceptance criteria

- 101 reports across 150 days complete; duplicate date conflicts and retry replays are distinct.
- Midnight/DST, same-day final-report edit and historical grant boundaries behave correctly.
- Expired/revoked/wrong-owner grants reject; correction never changes dates, counts or initial seeds.

## Progress, risks and evolution

Core lifecycle, setup/revisions, reporting/milestone locks, attempt-v1 seeds, streak credits, atomic completion and correction services are implemented. Deterministic unit tests and real PostgreSQL transaction/race tests provide domain evidence; browser/Discord integration and identity/privacy remain pending. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
