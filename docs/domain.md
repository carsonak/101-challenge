# Challenge domain

Status: accepted requirements, updated by the QA review on 2026-10-07. These rules are authoritative; implementation evidence is recorded with the tracker plans and tests. They supersede the initial proposals for destructive resets, Discord-only identity, enrollment-level seeds, and unconditional artwork immutability.

## Accounts and participation

Email/password, Google and Discord are independent sign-in methods. Linking requires authenticated proof of both accounts; matching email addresses never silently merges identities. Guild membership is not required. Guild commands are a convenience; the browser supports all participant functions.

A user has one enrollment per season. At most one never-completed season may be active for a user. Pause preserves progress but resets current streak and expires credits/perks immediately. It reserves the unfinished-season slot until the next reporting day; the same season can resume immediately. Cancellation is separate, irreversible and frees the slot immediately. It retains current-attempt private history by default, or erases that attempt’s logs, goals, milestones and frozen private inputs when the owner explicitly chooses erasure and types the season identifier. Earlier attempts and completion entitlements remain. Completion frees the slot. Restarts in previously completed seasons may run concurrently with another season. Serialize slot changes on the user, then enrollment, then attempt. One active attempt per enrollment.

Published seasons accept enrollment and cancellation without enrollment windows. Recommended goals/milestones and study-session information are optional templates; custom goals are equally valid. Draft seasons are not enrollable. Published seasons stay enrollable, including past seasons; admins may remove a season from featured listings without blocking direct enrollment. No archival deadline stops an ongoing attempt.

## Attempts and retained history

Starting requires initial goals, an enrollment timezone, and optional milestones. Record the start instant only when setup is explicitly submitted. Restart closes the current attempt and creates a new setup; it never deletes history. Resume continues a paused attempt; cancelled attempts can only be retried as a new attempt. Initial inputs are required again for a restarted attempt, with explicit template copying allowed.

Before first completion an attempt is qualifying; later attempts are progress-only. The 101st distinct reporting date atomically closes the attempt, records completion, and creates the unique seasonal completion entitlement if absent. Later attempts cannot silently replace that completion. Retained attempts and logs remain owner-readable. Full account erasure is a separate privileged privacy workflow.

## Reports, goals and milestones

A reporting day is a distinct local date with a truthful report, including no goal activity. Completion takes 101 reporting dates, which may span more than 101 calendar days. Missing dates break calendar streaks, not total progress. The enrollment IANA timezone is frozen once its first attempt starts. Server time determines ordinary report dates. New enrollments use the server-configured timezone (default Africa/Nairobi); existing frozen timezones remain. Admin-created participation can have an earlier effective registration date, with actual creation time retained for audit. Both effective registration and first publication bound historical reporting dates.

One report per attempt/local date. Duplicate submissions return a conflict offering edit; retries of the same command return the original logical result. Ordinary edits are allowed on that local date, including the 101st report after completion until midnight; paused/cancelled/restarted attempts require a correction grant (erased attempts have no editable history). Store the latest log text and values only, with createdAt/updatedAt, no log revision history. A valid correction grant can move an existing report to an unoccupied eligible past date. A separate administrator-created 24-hour backfill window permits inserting missing reports and editing associated milestones. Skipped placeholders never count; unfilled dates freeze when that window ends. Chronological order, streaks, milestone facts and eligible credits are recalculated atomically, while existing completion entitlements and frozen seed inputs remain fixed.

Initial goals are required. Goals are editable on active attempts for their lifetime. Every explicit goal/milestone save has a retained revision; reports reference the applicable revision. Milestones target a reporting index 1..101; lock the milestone when that report is accepted. Missing calendar dates do not lock it. Manual achievements are self-reported, and milestone facts never imply externally verified activity. Future-target milestones can be added/edited/removed with retained revisions. Completed/cancelled/restarted attempts are read-only except same-day final-log edits and authorized log corrections.

## Seeds, streaks and perks

Private random participant and season seeds feed an attempt base seed together with initial goals, start timestamp and optional initial milestones. Freeze initial inputs and the derivation version; later edits do not alter the base seed. A restarted attempt has new initial inputs/start time and a new base seed. Never expose seeds or private seed inputs through participant/admin UI, public API, logs, or SVG. Source code is inspectable under Apache-2.0; algorithm secrecy is not a security boundary.

Current streak is the trailing run when the last report is today or yesterday, otherwise zero. Longest is the maximum run. Every positive multiple of seven consecutive reporting dates grants one attempt-scoped reroll credit, keyed by earning report to avoid collisions across separate runs. Credits survive gaps, expire on pause/cancellation/restart, and cannot transfer. Spending is disabled while paused or cancelled. Streak perk tiers are separate from the credit balance; each seven-day streak increment earns a tier and each missed date reduces it by one, floored at zero. Concrete benefits belong to the artwork release contract. v0.1 records grants/balances and selected perks; artwork release enables spending. No paid, redeemable, transferable, or external-role rewards are included.

## Corrections and administration

Admins see timestamps for challenge/goals/milestones/logs, counts, streaks and selected perks, never private text. Admin-issued keys grant users the right to correct their own existing logs: a single-use key bound to one report, or an attempt-scoped edit window capped at one hour from issuance. Single-use keys expire after 24 hours. Separate single-use keys authorize deletion/replacement of one current seasonal artwork. Keys are high-entropy, hashed at rest, revocable, recipient/resource/action/expiry-bound and consumed atomically. Invalid, revoked, expired, already-used or wrong-owner keys reject. Corrections update source versions and metadata-only audit, not log history.

## Completion and artwork boundary

The tracker owns completion truth; artwork owns rendering and assets. Completion records remain fixed through ordinary operations. Correctable source facts are separate, versioned private data; neither correction nor art deletion grants another completion entitlement.

A local date's private tile/colour selection is fixed at midnight, calculated deterministically/lazily if no worker ran; first-day setup calculates immediately. No report means no tile revealed. An explicit reroll spends a credit and changes tile/colour. Each log save freezes new detail inputs using base seed, text, reporting progress, save timestamp, streak, selected perks and applicable milestone facts. Retry never samples a new timestamp. Dates/timestamps use the frozen timezone for local boundaries and UTC instants for persisted time.

Artwork has 101 irregular roughly equal-area tiles, evolving motifs, seasonal palettes and milestone markers. One current completed artwork exists per user/season. Qualifying restarts return preview progress to zero; progress-only attempts never auto-replace completed artwork. Authorized corrections rebuild using the completed attempt's corrected source. An artwork deletion grant removes the current piece and allows a new variation from that completed attempt without 101 new reports. Superseded public assets are removed; retain content-free audit and reject stale render publication.

Artwork is public on its separate release. Initial goals, milestones, longest streak and start/end dates are independently opt-in overlays, off by default. Public projections exclude seeds, log text, private identifiers and unselected fields. Turning a toggle off removes the corresponding published presentation; never bake private text into base SVG metadata. Previously downloaded copies cannot be recalled.

## Privacy and recovery

Keep logs and text private, including from admins. Logs and backups default to 30-day operational retention; participant history persists until account erasure. Export is owner-only; erasure revokes sessions, removes private inputs/assets/jobs and uses a privileged path for completion records. Restore replays the deletion ledger before serving traffic. Once-per-season guarantees apply to retained account identity; do not retain undeclared identity fingerprints after erasure.

## Profiles, publication and recovery

Usernames are case-insensitively unique, 3–32 ASCII letters, digits, underscores or hyphens. Provider defaults are suggestions, never proof of account ownership. Profile pictures are owner-controlled; uploads are decoded, resized and stripped of metadata. Provider email claims never merge accounts.

Season identifiers are unique lowercase hyphenated URL identifiers and freeze on publication. First publication is persisted independently from later edits; unknown legacy timestamps must be explicitly reconciled before historical reporting can use that season.

Account deletion requires a verified recovery email, recent sign-in and typed username. It suspends ordinary access and revokes sessions immediately, retaining private data for seven days. Fresh sign-in during the grace period permits recovery only. Recovery and deadline erasure serialize on the account. Privileged maintenance retries the recovery notice and erases due accounts; recovery is forbidden at or after the deadline even if maintenance is delayed.
