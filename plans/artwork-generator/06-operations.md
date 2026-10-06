# Artwork operations and release evidence

Owner: operations. A0 local build; A3 public release. Status: not implemented.

## Tasks

- [ ] Pin renderer/config/serializer/fonts/export runtime; package a reproducible worker image and resource/time limits.
- [ ] Add isolated art queues, bounded retries, terminal-failure triage, generation-aware cleanup and safe metadata metrics.
- [ ] Verify duplicate jobs, crash-after-upload, crash-before-publication, source edits during render, deletion during render and erasure during retry.
- [ ] Preserve encrypted current private inputs for reproducibility; overwrite superseded log-source payloads instead of keeping an alternate log-history archive. Store jobs by IDs/versions, not raw text.
- [ ] Build missing assets from current frozen edition inputs; recovery reproduces the same edition without spending a deletion grant or generating a variation.
- [ ] Reconcile database manifest, storage and deletion ledger during restore; no revoked edition may reappear.
- [ ] Run staged backfill and public projection review before enabling production gallery.

## Acceptance and rollout

A0 entry: verified foundation and checked fictional seed vectors. After A0, the lab milestone requires generator tests and a local gallery. A1: provider contract tests and atomic reroll spending. A2: single-current-artwork uniqueness, correction/deletion race tests and backfill. A3: storage isolation, sanitized exports, public toggle/privacy tests, purge/erasure/recovery drill and capacity test. Require tracker tests alongside art tests at integration.

Start rollout with fictional staging data, then a consented pilot. Enable only after current-source comparison and privacy checks pass. Rollback disables artwork delivery/jobs without stopping tracker reporting. Keep old pinned renderer available for reproducing existing current editions, but do not publish revoked ones. No automatic generator upgrades of completed artwork.

## Evolution

2026-10-06: initial separate-release plan; external storage/hosting not configured and not required for lab work.
