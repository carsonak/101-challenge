# Pre-QA readiness overview

## Goal and boundaries

Make the tracker understandable, supportable and reproducibly deployable before
manual QA. Preserve independent identities, owner-only report text, completion
entitlements, frozen seeds, retained history and append-only migrations. No
artwork renderer, paid rewards, automatic reminders or account merging is added.
Those features require separate product contracts; their current limits must be
visible to participants and operators.

## Sequence and dependencies

1. [Audit and disposition](findings.md): reconcile all G1–G19 recommendations and
   manual QA expectations with the current code, including the idle-worker change.
2. [Application and administration](plan.md): verification resend, safe account
   guidance, completion acknowledgement, timezone/reward copy and recipient-safe
   correction workflows. Security and compatibility precede UI wiring.
3. [Deployment and operations](plan.md): coherent tested runtime/tool versions,
   proxy trust, bootstrap procedure, recovery/support, scheduled backup and alert
   recipes, and a disposable burst trial.
4. [Verification](plan.md): real PostgreSQL/restricted identities, production
   build/smoke, browser accessibility/CSP/theme/viewport checks and synthetic
   screenshot inspection; update dated evidence and manual QA instructions.
5. Submit a PR and leave it open for review. Do not merge or deploy.

## Release gates

Local checks cannot establish production deliverability, sender DNS, OAuth consent,
Discord client compatibility, firewall/proxy behavior, off-server backup durability,
server restore timing, resource capacity or legal acceptance. Keep these unchecked
in [hosted acceptance](../../docs/pilot-readiness.md), with a named evidence record
and reviewer before invitations. Never substitute fixture success for hosted QA.

## Progress and risks

Repository implementation and local acceptance are complete; PR review and hosted
acceptance remain. Current default branch contains the
idle-worker redesign; PostgreSQL rate buckets already survive process restarts and
are shared across replicas. Historical pg-boss and single-process assumptions in
the supplied review must be corrected. The repository integration branch is behind
the current application; the owner selected main as this PR target without
rewriting either long-lived branch.

The first pilot remains gated on the complete manual pass, including day-boundary,
real provider and operational failure scenarios. No claim of zero bugs follows
from automated checks.

Local verification found and resolved stale credential proofs, unreadable private
operator/maintenance sources in non-root images, incomplete dump publication and
enlarged-text footer overflow. An additive operator-only suspension table supports
incident containment; read-only role and erasure regressions cover it. The scoped
admin path reads report metadata only and pages attempts; the legacy global API
remains for compatibility.

UI changes retain the accepted lake/paper semantic tokens, self-hosted type,
left-aligned forms and existing card structure. New controls use existing fields
and buttons; no independent visual system or speculative reward feature was added.
