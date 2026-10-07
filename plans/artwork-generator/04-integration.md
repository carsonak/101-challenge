# Tracker integration and artwork lifecycle

Owner: integration. Gates A1 for previews/credits; A2 for completion/corrections/backfill. Status: not implemented.

## State and authority

Tracker owns private facts and entitlement truth. Art tables own date selections, reroll ledger, artwork slot UNIQUE(entitlementId), edition generation, input/source digest, pinned generator/config, render status and storage reference. A qualifying preview belongs to one attempt. Restart hides its active preview and starts a new preview at tile zero; retained tracker history is untouched. Completed artwork remains attached to the first completed attempt. Progress-only attempts do not create seasonal previews or auto-replace that piece.

Render states pending/running/ready/failed/revoked. Every job carries attempt sourceVersion, edition generation and renderer/config version. Snapshot source atomically; publication uses compare-and-swap on the same current generation/source. Stale results are discarded and stored files removed. Serialize credit consumption, reroll counter and selection change; replay uses the same receipt. Reroll is allowed on the current local date of an active attempt or same-day final report, not on historical reports via an edit grant.

Completion creates the one artwork slot idempotently and queues final render. Same-day final-report saves and authorized later corrections invalidate its source revision and rebuild from corrected completed data. The original completion record does not change. A corrected published piece is withdrawn until its replacement is ready, so stale artwork is not served as current.

Artwork deletion grants are separate from log grants. Redeem a recipient-bound, current-edition-bound 24h single-use token with recent authentication. Atomically revoke current edition, advance generation and variation counter, and enqueue cleanup/replacement from the completed attempt. A retry does not grant another variation. Keep one current slot, purge superseded public bytes, retain only content-free edition/audit metadata. Seed and completion remain fixed.

## Backfill

Select completed entitlements first, regardless of a current progress-only attempt. Freeze current corrected report source and assign the pinned initial generator/config; reproduce logical midnight choices sequentially from retained reports and their saved timestamps/facts. Enrollments without completion use only the active qualifying attempt. Key batches by sourceVersion/generation; rerun safely, checkpoint, bound concurrency, and never expose partial unreviewed backfill publicly before A3.

## Tasks and tests

- [ ] Private tracker provider and consistent source snapshots; no direct adapter writes to core tables.
- [ ] Credit spending and selection transactions with simultaneous reroll/retry tests.
- [ ] Preview/final/replacement state machine, source invalidation and stale-publication tests.
- [ ] Scoped deletion grants plus expiry/revocation/replay/ownership tests.
- [ ] Backfill tests for completed-then-restarted, corrected, cancelled, never-completed and erased accounts.

A worker outage delays artwork only; reports/completion remain available. No change to tracker completion counts is permitted by art code.

## Accepted QA lifecycle boundary

Pause expires active benefits and credits immediately; gaps preserve credits and reduce the separately defined perk tier. Concrete tier benefits remain an artwork-release decision. Cancellation removes incomplete preview progress; retained completion entitlements and completed seasonal artwork survive. An erased cancelled attempt exposes only an erased tombstone, never zeroed synthetic seed inputs as renderable source. Historical date corrections and backfill increment source versions and require chronological re-projection; stale render publication must still reject. Frozen attempt seed inputs and existing completion entitlements cannot be replaced by this recalculation.
