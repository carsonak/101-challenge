# Security, privacy and administrative grants

Status: local implementation verified; external release gates remain. Owner role: Security owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Protect private text and seed inputs; admins receive metadata only. Public artwork is a separate release.

Dependencies/gates: F1 data inventory; provider/storage checks at external gates.

## Contracts and behavior

Server-only owner projections include private text, not seeds; admin projections expose timestamps/counts/streaks/selected perks, not text or seed inputs. Use role-based administration independent of Discord guild roles. Escape content, prevent unwanted mentions, rate-limit auth/grants and require recent authentication for sensitive actions. Raw grant token shown only at issuance; recipient redeems; never log it. Default logs/backups 30 days; history until erasure.

## Implementation tasks

- [x] Implement projection allowlists and authorization tests for every resource.
- [x] Implement owner export and authenticated erasure request with audited privileged execution, session revocation and deletion ledger.
- [x] Ensure same-day edits/corrections overwrite bodies without alternate application history.
- [x] Document seed access for developers only through controlled server diagnostics; no seed debug endpoint.
- [x] Document retention/visibility explanations and prepare restore/incident procedures.

## Acceptance criteria

- Cross-user IDs and forged admin claims fail; logs contain no bodies, credentials, seeds or keys.
- Key scope/use/window enforced atomically; max edit-window expiry <= issuedAt + 1h.
- Restore replays erasures before traffic; reset/restart never masquerades as account deletion.

## Progress, risks and evolution

Projection allowlists, owner export, recent-authenticated erasure requests, restricted runtime privileges and privileged deletion-ledger replay are implemented and verified. Completed-account erasure also removes the new actor-bound forms, outbox receipts and source projections; replayed erased events are ignored. Browser account/retention explanations, no-store queries and no-referrer headers are implemented. Runbooks live in `docs/authentication.md` and `docs/operations.md`. No broad operator CLI or public role-promotion endpoint is included; live provisioning remains an external gate.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
