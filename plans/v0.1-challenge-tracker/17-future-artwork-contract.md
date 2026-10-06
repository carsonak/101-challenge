# Future artwork boundary

Status: accepted interface direction; no artwork runtime in v0.1.

The [artwork initiative](../artwork-generator/README.md) owns rendering, fixtures, integration and release. Its [input contract](../artwork-generator/01-input-contract.md) specifies private derivation inputs and source versions; [gates](../artwork-generator/OVERVIEW.md) define when parallel work may start.

## Tracker prerequisites

- [ ] Persist per-attempt immutable initial inputs/base seed/derivation version.
- [ ] Retain reports and goal/milestone revisions, with private current daily source facts and sourceVersion.
- [ ] Record earning-report-keyed streak credits and selected perks.
- [ ] Persist unique completion and original reporting dates separately from correctable source.
- [ ] Implement metadata events and correction grants that invalidate source versions.

These generic tracker facts are core responsibilities. The approved fictional [fixtures](../artwork-generator/fixtures/README.md) let the artwork lab begin without tracker implementation. Real-source integration requires gate A1; completed artwork requires A2. Artwork-deletion keys, reroll spending, rendering jobs, public projections and asset storage are implemented only on the artwork track.

## Acceptance

No renderer, art routes, art UI, render jobs, buckets or artwork package dependency in v0.1. Source data supports deterministic backfill without old log versions. Corrections never change initial seed inputs or completion facts. Progress-only attempts cannot automatically replace seasonal artwork. Public APIs never expose private source contracts.

## Evolution

2026-10-06: replaced unconditional immutable-artwork/enrollment-seed proposal with per-attempt seeds and explicit replacement grants; see [ADR 0002](../../docs/adr/0002-history-seeds-and-artwork.md).
