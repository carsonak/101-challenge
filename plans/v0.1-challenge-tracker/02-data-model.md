# Data model

Status: requirements accepted; feature implementation not started. Owner role: Database/integration owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Separate identities, retained progress, completion facts and correctable private source inputs. No artwork asset tables in v0.1.

Dependencies/gates: F1 review of 04–09 and 12; migrations require only local PostgreSQL.

## Contracts and behavior

Tables: users/private participant seed; credentials and identities UNIQUE(provider,subject); sessions and expiring verification/recovery tokens; seasons/private season seed/templates; enrollments UNIQUE(userId,seasonId); user_season_slots UNIQUE(userId); attempts UNIQUE(enrollmentId,sequence) with partial UNIQUE active enrollment; goals/goal_revisions; milestones/milestone_revisions; reports UNIQUE(attemptId,reportingDate); report_goal_values referencing same-attempt goal revisions; private daily source facts; streak projections; perk credits/grants; completion_entitlements UNIQUE(enrollmentId); correction_grants; metadata audit, idempotency and outbox. Use UUIDs, text provider IDs, UTC timestamptz and SQL local dates. attempt states: active, cancelled, restarted, completed; setup is submitted atomically with start. Enrollment participation: active/cancelled/completed. Persist createdAt/updatedAt on all admin-visible entities. Include baseSeed/seedVersion/initialInputDigest/startedAt and sourceVersion on attempts; retain frozen initial revisions. Completion stores original 101 dates and minimal metadata, not report text or a public seed. Corrections increment mutable sourceVersion without updating the original entitlement.

## Implementation tasks

- [x] Create initial migration in dependency order, indexed owner queries and cursor columns.
- [x] Constrain report-goal ownership and active-attempt uniqueness; serialize user slot claims transactionally.
- [x] Store grant token hashes, expiry, revocation/use metadata; ensure grant use and correction are atomic.
- [ ] Use a restricted app role for completion facts and a separate privileged erasure path. No progress cascade on ordinary restart/cancel.

## Acceptance criteria

- Clean migration and schema constraints pass on real PostgreSQL.
- Concurrent slot claims/enrollments/completions yield one slot/enrollment/entitlement.
- Restart/cancel retain all history; cross-attempt references fail; correction changes source version but not completion.

## Progress, risks and evolution

Implemented a clean typed-column PostgreSQL migration, Drizzle transaction repository, owner indexes, composite revision/report ownership, slot/active-attempt uniqueness and grant expiry/use storage. Real PostgreSQL integration tests cover rollback, cross-attempt references, slot races, retained restarts and immutable completion under corrections. Application-role and privileged erasure work remains with identity/privacy. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
