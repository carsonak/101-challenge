# Challenge domain

Status: accepted requirements, 2026-10-06. These rules describe intended behavior, not implemented features. They supersede the initial proposals for destructive resets, Discord-only identity, enrollment-level seeds, and unconditional artwork immutability.

## Accounts and participation

Email/password, Google and Discord are independent sign-in methods. Linking requires authenticated proof of both accounts; matching email addresses never silently merges identities. Guild membership is not required. Guild commands are a convenience; the browser supports all participant functions.

A user has one enrollment per season. At most one never-completed season may be active for a user. Cancellation preserves the enrollment, attempt and logs and frees the slot; resumption needs that slot again. Completion frees the slot. Restarts in previously completed seasons may run concurrently with another season. Serialize slot changes on the user, then enrollment, then attempt. One active attempt per enrollment.

Published seasons accept enrollment and cancellation without enrollment windows. Recommended goals/milestones and study-session information are optional templates; custom goals are equally valid. Draft seasons are not enrollable; retirement hides new enrollment but preserves existing participation and history. No automatic archival deadline stops an ongoing attempt.

## Attempts and retained history

Starting requires initial goals, an enrollment timezone, and optional milestones. Record the start instant only when setup is explicitly submitted. Restart closes the current attempt and creates a new setup; it never deletes history. Cancellation pauses the current attempt; resume continues it. Initial inputs are required again for a restarted attempt, with explicit template copying allowed.

Before first completion an attempt is qualifying; later attempts are progress-only. The 101st distinct reporting date atomically closes the attempt, records completion, and creates the unique seasonal completion entitlement if absent. Later attempts cannot silently replace that completion. Retained attempts and logs remain owner-readable. Full account erasure is a separate privileged privacy workflow.

## Reports, goals and milestones

A reporting day is a distinct local date with a truthful report, including no goal activity. Completion takes 101 reporting dates, which may span more than 101 calendar days. Missing dates break calendar streaks, not total progress. The enrollment IANA timezone is frozen once its first attempt starts. Server time determines report dates; no ordinary backdating.

One report per attempt/local date. Duplicate submissions return a conflict offering edit; retries of the same command return the original logical result. Ordinary edits are allowed on that local date, including the 101st report after completion until midnight; cancelled/restarted attempts require a correction grant. Store the latest log text and values only, with createdAt/updatedAt, no log revision history. Corrections do not insert dates, change reporting dates, or change completion counts.

Initial goals are required. Goals are editable on active attempts for their lifetime. Every explicit goal/milestone save has a retained revision; reports reference the applicable revision. Milestones target a reporting index 1..101; lock the milestone when that report is accepted. Missing calendar dates do not lock it. Manual achievements are self-reported, and milestone facts never imply externally verified activity. Future-target milestones can be added/edited/removed with retained revisions. Completed/cancelled/restarted attempts are read-only except same-day final-log edits and authorized log corrections.

## Seeds, streaks and perks

Private random participant and season seeds feed an attempt base seed together with initial goals, start timestamp and optional initial milestones. Freeze initial inputs and the derivation version; later edits do not alter the base seed. A restarted attempt has new initial inputs/start time and a new base seed. Never expose seeds or private seed inputs through participant/admin UI, public API, logs, or SVG. Source code is inspectable under Apache-2.0; algorithm secrecy is not a security boundary.

Current streak is the trailing run when the last report is today or yesterday, otherwise zero. Longest is the maximum run. Every positive multiple of seven consecutive reporting dates grants one attempt-scoped reroll credit, keyed by earning report to avoid collisions across separate runs. Credits survive gaps, expire on restart/cancellation, and cannot transfer. v0.1 records grants/balances and selected perks; artwork release enables spending. No paid, redeemable, transferable, or external-role rewards are included.

## Corrections and administration

Admins see timestamps for challenge/goals/milestones/logs, counts, streaks and selected perks, never private text. Admin-issued keys grant users the right to correct their own existing logs: a single-use key bound to one report, or an attempt-scoped edit window capped at one hour from issuance. Single-use keys expire after 24 hours. Separate single-use keys authorize deletion/replacement of one current seasonal artwork. Keys are high-entropy, hashed at rest, revocable, recipient/resource/action/expiry-bound and consumed atomically. Invalid, revoked, expired, already-used or wrong-owner keys reject. Corrections update source versions and metadata-only audit, not log history.

## Completion and artwork boundary

The tracker owns completion truth; artwork owns rendering and assets. Completion records remain fixed through ordinary operations. Correctable source facts are separate, versioned private data; neither correction nor art deletion grants another completion entitlement.

A local date's private tile/colour selection is fixed at midnight, calculated deterministically/lazily if no worker ran; first-day setup calculates immediately. No report means no tile revealed. An explicit reroll spends a credit and changes tile/colour. Each log save freezes new detail inputs using base seed, text, reporting progress, save timestamp, streak, selected perks and applicable milestone facts. Retry never samples a new timestamp. Dates/timestamps use the frozen timezone for local boundaries and UTC instants for persisted time.

Artwork has 101 irregular roughly equal-area tiles, evolving motifs, seasonal palettes and milestone markers. One current completed artwork exists per user/season. Qualifying restarts return preview progress to zero; progress-only attempts never auto-replace completed artwork. Authorized corrections rebuild using the completed attempt's corrected source. An artwork deletion grant removes the current piece and allows a new variation from that completed attempt without 101 new reports. Superseded public assets are removed; retain content-free audit and reject stale render publication.

Artwork is public on its separate release. Initial goals, milestones, longest streak and start/end dates are independently opt-in overlays, off by default. Public projections exclude seeds, log text, private identifiers and unselected fields. Turning a toggle off removes the corresponding published presentation; never bake private text into base SVG metadata. Previously downloaded copies cannot be recalled.

## Privacy and recovery

Keep logs and text private, including from admins. Logs and backups default to 30-day operational retention; participant history persists until account erasure. Export is owner-only; erasure revokes sessions, removes private inputs/assets/jobs and uses a privileged path for completion records. Restore replays the deletion ledger before serving traffic. Once-per-season guarantees apply to retained account identity; do not retain undeclared identity fingerprints after erasure.
