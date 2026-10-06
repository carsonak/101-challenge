# Browser flows

Status: requirements accepted; feature implementation not started. Owner role: Web owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Browser supports every participant operation without Discord. No artwork preview/gallery/button/status in v0.1.

Dependencies/gates: F1 typed fixtures; F2/F3 services; live auth behind external gates.

## Contracts and behavior

Routes: /login, /signup, /account, /seasons, /seasons/[id], /challenge/[enrollmentId], /history, /admin/seasons and /admin/corrections. Show reporting count separately from streaks, season slot, timezone, history, credit balance and completion. Provider buttons appear only when configured. Admin views expose metadata only.

## Implementation tasks

- [ ] Build accessible setup, optional template selection, reports and same-day editing.
- [ ] Add goal/milestone revision views, cancellation/resume and retained restart confirmation.
- [ ] Add email verification/recovery, OAuth/linking and account settings.
- [ ] Add admin season/template controls and correction-key issuance/revocation; user key redemption.

## Acceptance criteria

- Email-only user completes all participant flows; keyboard/error/focus/mobile checks pass.
- Unsent text survives errors; stale versions refresh safely; private data is not shared through caches.
- UI explains expired editing windows and retained history, and shows no artwork runtime placeholders.

## Progress, risks and evolution

No feature implementation evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
