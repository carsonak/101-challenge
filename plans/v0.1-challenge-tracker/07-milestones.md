# Milestone revisions and locks

Status: local implementation verified; external release gates remain. Owner role: Milestone owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Optional milestones target reporting indices 1..101 and create future artwork marker facts.

Dependencies/gates: F1, goals and reporting.

## Contracts and behavior

Milestones have title <=200, optional description <=4000, targetReportingDay, optional same-attempt goal, manual or reporting_count achievement kind. Maximum 101 milestones per attempt. Every explicit save/removal has a retained revision. Lock current revision when its target report is accepted; manual achievement is self-reported at that report. Only future targets may change. Frozen report facts refer to the revision, not mutable latest title.

## Implementation tasks

- [x] Implement create/revise/archive with active status, ownership and future-target checks.
- [x] Persist revision/achievement facts when target reporting day is accepted.
- [x] Expose owner revision history and metadata-only admin projections.

## Acceptance criteria

- Calendar gaps do not lock milestones; acceptance of target report does.
- Concurrent report/save resolves under the attempt lock, never ambiguous revision selection.
- Private titles are absent from metadata events and admin responses.

## Progress, risks and evolution

Core lifecycle, setup/revisions, reporting/milestone locks, attempt-v1 seeds, streak credits, atomic completion and correction services are implemented. Deterministic unit tests and real PostgreSQL transaction/race tests provide domain evidence; browser/Discord integration and identity/privacy are verified at F3. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
