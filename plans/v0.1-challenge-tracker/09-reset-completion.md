# Restart, cancellation and completion

Status: requirements accepted; feature implementation not started. Owner role: Lifecycle/integration owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Retain all history. Separate unique completion from future replacement artwork.

Dependencies/gates: F1, schema and report transaction; supplies artwork A2.

## Contracts and behavior

Lock order user → enrollment → attempt → affected report/grant/credit. Active qualifying restart: mark restarted, retain progress, expire credits and create a new started attempt from explicitly submitted initial goals/milestones under the same season slot. Collect the new setup before submitting RestartAttempt so there is no half-created successor. Cancellation pauses attempt and frees slot; resume requires slot. Qualifying report 101: close attempt, insert unique entitlement and release slot atomically. After first completion, restarts create progress-only attempts without claiming unfinished slot. Progress-only report 101 closes without entitlement change. Restart confirmation binds actor/attempt/version and describes retained history plus preview/credit reset; no delete-progress language.

## Implementation tasks

- [ ] Implement versioned lifecycle commands and transaction rollback.
- [ ] Freeze first-completion identity/date/reporting dates, keeping mutable correction source separate.
- [ ] Invalidate stale work using source/attempt versions and enqueue metadata events.
- [ ] Expose retained history and continuation rules through both adapters.

## Acceptance criteria

- Restart vs report 101: one wins, the stale command rejects; no lost history or double entitlement.
- Retry restart returns the same successor; failed completion rolls back report/slot changes.
- Corrections/replacement grants never mint new completion; same-day final-report edits preserve completion facts.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
