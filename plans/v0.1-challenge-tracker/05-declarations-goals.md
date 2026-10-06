# Initial goals and revisions

Status: requirements accepted; feature implementation not started. Owner role: Goals owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Require one or more initial goals; optional declaration and milestones. No reading-only assumptions.

Dependencies/gates: F1 and lifecycle; initial inputs feed 08.

## Contracts and behavior

StartAttempt atomically saves initial goal/milestone revisions and seed inputs. Goal kinds qualitative/count/duration/quantity; positive optional targets and nonnegative decimal values represented as decimal strings (maximum 18 digits, 6 fractional), avoiding binary floating-point arithmetic. Goal titles max 200 characters, optional description max 4000, unit max 40; max 20 goals per attempt. Archive retains revisions and references. Every explicit save has a new revision; no keystroke/autosave history.

## Implementation tasks

- [ ] Implement setup draft in the UI; submit initial inputs once to create started attempt.
- [ ] Implement active-attempt goal revisions and explicit template-copy on restart.
- [ ] Reference applicable goal revisions from reports, preserving historical definitions.

## Acceptance criteria

- Custom non-reading goals and target-free goals work; empty initial goals reject.
- Saved revisions remain owner-readable; edits never mutate seed or initial input digest.
- Completed/cancelled/restarted goal edits reject.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
