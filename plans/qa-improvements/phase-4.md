# Phase 4: Lifecycle and historical corrections

Status: implemented; final verification is recorded in [OVERVIEW.md](OVERVIEW.md).

## Implementation

Separate pause and irreversible cancellation commands, next-reporting-day slot release, immediate same-season resume, cleared pause benefits, preserved longest streak and completion entitlements. Cancellation defaults to retaining history and can narrowly erase the current attempt. Backdated registration preserves creation audit time and issues a distinct 24-hour grant. Historical changes enforce publication/registration/future/occupied-date bounds and transactionally recalculate ordered reports, progress, streaks, milestones and eligible credits.

## Acceptance and evidence

PostgreSQL tests exercise pause/resume, current-attempt erasure, retained revisions, legacy cancelled-to-paused migration, grant revocation and expiry, occupied dates, reverse-order backfill through the 101st report and stable completion entitlement/seed inputs. Browser coverage exercises pause, typed cancellation and retry; a dedicated backfill scenario checks eligible date selection, occupied-date removal and non-counting skipped placeholders. Artwork source facts are versioned; rendering remains a separate release.

See the [item-by-item mapping](checklist.md). Live provider configuration, production email delivery and deployment are external release checks; local provider doubles and Mailpit verify application behavior.
