# Pre-QA implementation plan

## Audit and planning

- [x] Read both supplied documents, repository instructions, contributor practices,
      accepted domain/design/architecture decisions and current deployment plans.
- [x] Inspect Git baseline and preserve the clean checkout on an isolated fix branch.
- [x] Complete independent code/configuration audit and dispositions for every G item.
- [x] Record scope changes and additional findings as implementation supplies evidence.

## Application and administration

- [x] Add enumeration-safe verification resend, using the existing shared mail
      cooldown, post-commit delivery and no account creation or password hashing.
      Add discoverable login/verification links and actionable rate-limit feedback.
- [x] Explain independent provider identities at login/signup and Discord handoff.
- [x] Explain frozen reporting timezone during setup and current artwork/credit
      limits on public, challenge and completion surfaces.
- [x] Retain completion acknowledgement and links on Home after slot release.
- [x] Make correction administration participant-first, then attempt/report; name
      the recipient, require confirmation and scope reads to bounded participant
      metadata. Preserve the existing metadata endpoint contract for old clients.
- [x] Improve backdating validation and prevent unsafe or ambiguous grant choices.
- [x] Provide a visible contact/help path and safe password/email change guidance;
      document recovery and identity conflicts without silently merging accounts.
- [x] Unify edit-report timezone fallback and fix deletion/recovery-address subjects.

## Deployment and operations

- [x] Align production PostgreSQL with local/CI and its data-directory layout;
      require reviewed image versions/digests at release time.
- [x] Align Docker Node/pnpm with the manifest, support the environment's build CA,
      and verify non-root/read-only runtime behavior and static assets.
- [x] Configure trusted client headers explicitly for the protected Caddy topology;
      document ingress isolation and two-network acceptance.
- [x] Add numbered bootstrap/update/rollback procedures with executable one-shot
      role/migration/grant tooling, readiness, admin promotion and first-season steps.
- [x] Supply private backup/ledger schedules and alert procedures, including
      maintenance ordering, off-server/versioned storage and erasure-safe restoration.
- [x] Write support procedures for verification failure, admin changes, compromised
      access, lost email/provider access, duplicate accounts and accidental erasure.
- [x] Supply a bounded synthetic staging burst trial with disposable-target guards,
      clear measurements and resource/error acceptance criteria.
- [x] Correct stale worker/rate-limit documentation; retain explicit monitoring,
      live providers, legal/contact and hosted performance acceptance gates.

## Verification and delivery

- [x] Run the required aggregate checks on real disposable PostgreSQL, investigate
      every failure and unexpected skip, and add focused behavioral regressions.
- [x] Build production web/worker; run smoke against restricted identities and
      without database configuration. Validate the production Compose/Caddy assets.
- [x] Run relevant Playwright checks; capture and inspect affected screens in both
      themes and phone/tablet/desktop sizes. Keep artifacts outside the repository.
- [x] Record dated evidence and unexecuted hosted checks, reconcile the QA guide
      with current behavior and provide a reusable results template.
- [x] Review the final diff for privacy, compatibility, documentation and scope.
- [x] Push conventional commits, create and attach a PR, inspect CI/review status
      and leave it open pending review.

## Acceptance criteria

All repository-executable fixes and required checks complete on the submitted
implementation; no private credentials or participant data in tracked files.
Manual QA has explicit cases for new behavior and unchanged security/domain
invariants. External gates remain visibly pending with executable procedures and
evidence requirements. Applied migrations are immutable; new interfaces are
additive. Readiness never implies all hosted acceptance has passed.

## Executed outcome

Application and deployment fixes are committed. Aggregate acceptance passed all
96 named tests on real PostgreSQL with no skips; all 15 browser tests passed.
Affected-route captures were rechecked after capture-position correction. Four
production image targets built, fresh operator roles/migrate/grants passed, and
web/worker/maintenance ran as non-root with read-only roots and working readiness.
Actual encrypted restore replay preserved 101 reports/completion/seeds and removed
the post-snapshot erased account. See [dated evidence](../../docs/verification.md).

The twenty-user local trial accepted all 61 measured writes, stored exactly twenty
reports and recorded p95 442 ms. This is local evidence; the fifty-user actual-VPS
trial, memory/CPU sizing, real providers, inbox placement, legal acceptance, alert
delivery and off-server restore remain mandatory hosted gates. Runtime deployment,
console configuration, invitations and release tagging were not performed.

[PR #2](https://github.com/carsonak/101-challenge/pull/2) targets main and remains
open for review. GitHub CI runs against the pushed head; review approval and
merge are outstanding. No deployment follows automatically from this handoff.
