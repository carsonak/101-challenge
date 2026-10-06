# Security, privacy and administrative grants

Status: requirements accepted; feature implementation not started. Owner role: Security owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Protect private text and seed inputs; admins receive metadata only. Public artwork is a separate release.

Dependencies/gates: F1 data inventory; provider/storage checks at external gates.

## Contracts and behavior

Server-only owner projections include private text, not seeds; admin projections expose timestamps/counts/streaks/selected perks, not text or seed inputs. Use role-based administration independent of Discord guild roles. Escape content, prevent unwanted mentions, rate-limit auth/grants and require recent authentication for sensitive actions. Raw grant token shown only at issuance; recipient redeems; never log it. Default logs/backups 30 days; history until erasure.

## Implementation tasks

- [ ] Implement projection allowlists and authorization tests for every resource.
- [ ] Implement owner export and authenticated erasure request with audited privileged execution, session revocation and deletion ledger.
- [ ] Ensure same-day edits/corrections overwrite bodies without alternate application history.
- [ ] Document seed access for developers only through controlled server diagnostics; no seed debug endpoint.
- [ ] Publish retention/visibility explanations and prepare restore/incident procedures.

## Acceptance criteria

- Cross-user IDs and forged admin claims fail; logs contain no bodies, credentials, seeds or keys.
- Key scope/use/window enforced atomically; max edit-window expiry <= issuedAt + 1h.
- Restore replays erasures before traffic; reset/restart never masquerades as account deletion.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
