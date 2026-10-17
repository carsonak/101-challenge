# Audit findings and dispositions

Initial audit: 17 October 2026, against the current default-branch application.
The implementation and local acceptance are complete. Hosted gates below remain
open until owner/server evidence exists.

| ID  | Current finding / disposition                                                                            | Resolution and remaining acceptance                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Shared PostgreSQL limits exist, but protected ingress lacks explicit trust settings.                     | Set Caddy-specific trust in production Compose; verify spoof protection locally and independent networks on host.                            |
| G2  | Verification has no resend path; delivery is external.                                                   | Add explicit safe resend and shared cooldown regression; require real inbox/sender-DNS evidence.                                             |
| G3  | Bootstrap is prose only.                                                                                 | One-shot operator tooling and numbered rehearsal/update/rollback runbook; host rehearsal stays gated.                                        |
| G4  | Production uses PostgreSQL 18 while local/CI use 17.11.                                                  | Align 17.11 and volume layout; no in-place major downgrade of existing data. Require reviewed release digests.                               |
| G5  | Backup tooling lacks schedule/install recipe and hosted evidence.                                        | Provide private timers/ledger sequence and stale-backup checks; off-server timed restore remains mandatory.                                  |
| G6  | Fixture OAuth and Discord coverage does not prove providers.                                             | Run remote CI after PR, retain provider-console and real-client manual gates.                                                                |
| G7  | Legal/contact acceptance is outstanding.                                                                 | Expose help/contact; require monitored CONTACT_EMAIL and qualified owner review before invitation.                                           |
| G8  | Credit counters lack spending availability context.                                                      | State artwork is a later release and credits cannot yet be spent. Do not promise paid/redeemable value.                                      |
| G9  | Independent provider accounts can confuse returning users.                                               | Explain linking before provider choice and in Discord handoff; keep proof-based identity policy.                                             |
| G10 | Global metadata enumeration and ambiguous correction recipients.                                         | Add bounded participant lookup/detail, recipient-first selection and explicit confirmation; preserve metadata privacy.                       |
| G11 | Support procedures are incomplete.                                                                       | Reviewed least-privilege support runbook, clear escalation boundaries and public help/contact. No unverifiable ownership bypass.             |
| G12 | Reminders intentionally deferred.                                                                        | Document owner-run weekly community reminder and pilot metric; do not send messages or create a scheduler without separate direction.        |
| G13 | No measured signup/report burst.                                                                         | Guarded disposable trial and resource criteria; measure locally where possible and repeat on actual VPS before invitations.                  |
| G14 | No configured external monitors.                                                                         | Provide actionable readiness/log/overdue-work/backup alert recipe with delivery test gates; avoid claiming a live monitor exists.            |
| G15 | No ordinary password or sign-in-email change.                                                            | Document supported recovery and proof-based replacement options and limitations; assess safe additive password action during implementation. |
| G16 | Setup does not name reporting timezone.                                                                  | Display actual configured/frozen IANA zone, never browser-derived reporting dates.                                                           |
| G17 | Home forgets completed seasons.                                                                          | Show durable completion acknowledgement and history link without taking a slot or changing entitlement.                                      |
| G18 | Rate-limit finding superseded by ADR 0003; owner history/admin reads remain broad.                       | Correct obsolete assumption; bound new admin path; document history/replica capacity and load evidence.                                      |
| G19 | Small copy/timezone inconsistencies and absent help.                                                     | Fix subject/fallback/help; keep noindex for pilot and require reviewed release/tag after merge.                                              |
| A1  | Docker installs pnpm 12.9.1 while manifest requires >=12.9.1 and selects 12.11.2; reproducibility drift. | Match manifest-selected pnpm and runtime Node; verify frozen install/build.                                                                  |
| A2  | Read-only web image required runtime verification.                                                       | Final web image serves routes/assets with a writable cache tmpfs and read-only root; source ownership was separately fixed under A6.         |
| A3  | Idle-worker migration makes older queue/bootstrap/runbook text misleading.                               | Reconcile durable outbox and maintenance instructions; old/new workers must not overlap migration 0008.                                      |

No supplied recommendation authorizes modifying provider consoles, infrastructure,
legal statements, real account verification or sending community messages.

## Additional audit outcomes

| ID  | Finding                                                                                             | Resolution / evidence                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A4  | Unused verify/reset proofs could survive unlinking email and authorize its replacement credential.  | Invalidate credential proofs on unlink/add/change/reset under the account lock; regressions use genuinely unused old verification and reset links.                                   |
| A5  | Support had no reversible way to contain a compromised account while preserving identities/history. | Migration 0009 adds an operator-only suspension; existing/new sessions, Discord lookup and tracker access reject. Real restricted logins cannot mutate it; erasure removes the flag. |
| A6  | Source copied from a mode-0700 checkout was unreadable by non-root maintenance/operator images.     | Copy source with node ownership; all four final targets build and fresh one-shot bootstrap plus read-only resident readiness pass.                                                   |
| A7  | Adding footer contact caused horizontal overflow at 200% text on a narrow screen.                   | Footer wraps links; final browser matrix and enlarged-text regression pass, screenshots inspected.                                                                                   |
| A8  | Encryption could rename a partial archive before pg_dump's failing exit was known.                  | Await producer success before publication; a failing producer leaves no final archive or success marker. Real encrypted restore and failure regressions pass.                        |
| A9  | A synthetic burst tool could point its web URL at a different database than its fixture URL.        | Before any HTTP signup, prove the server recognizes an independently generated disposable account; mismatch aborts after a fictional failed login.                                   |

## Final dispositions

G1–G4, G8–G11 and G15–G19 have repository fixes or documented safe supported
workflows, with local evidence. Production Compose pins verified PostgreSQL/Caddy
digests. G5/G14 have runnable tooling and timer/alert setup instructions, while
actual scheduling/storage/delivery remain hosted tasks. G6/G7/G13 require final
provider, legal/contact and VPS-capacity evidence. G12 intentionally keeps automatic
reminders deferred, as the supplied review recommends; the owner may post a weekly
community reminder linking Home and measure three-report week-one participation.
No message or external monitor was created. Artwork, account merging, a dedicated
audit-log UI and single-step sign-in-email replacement remain separate product
work; supported identity replacement and incident procedures are explicit.

The old G18 per-process limiter finding is superseded by ADR 0003. Owner history
and the legacy global stats response still load retained data broadly; the new
admin screen uses bounded, participant-scoped metadata instead. Revisit owner
history projections/connection budgets before large cohorts or replica expansion.

Remote baseline CI was independently confirmed green for the current main commit.
The submitted PR must also pass its own CI; neither result establishes live
provider behavior.
