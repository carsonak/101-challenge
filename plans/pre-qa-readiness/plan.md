# Pre-QA implementation plan

## Audit and planning

- [x] Read both supplied documents, repository instructions, contributor practices,
      accepted domain/design/architecture decisions and current deployment plans.
- [x] Inspect Git baseline and preserve the clean checkout on an isolated fix branch.
- [ ] Complete independent code/configuration audit and dispositions for every G item.
- [ ] Record scope changes and additional findings as implementation supplies evidence.

## Application and administration

- [ ] Add enumeration-safe verification resend, using the existing shared mail
      cooldown, post-commit delivery and no account creation or password hashing.
      Add discoverable login/verification links and actionable rate-limit feedback.
- [ ] Explain independent provider identities at login/signup and Discord handoff.
- [ ] Explain frozen reporting timezone during setup and current artwork/credit
      limits on public, challenge and completion surfaces.
- [ ] Retain completion acknowledgement and links on Home after slot release.
- [ ] Make correction administration participant-first, then attempt/report; name
      the recipient, require confirmation and scope reads to bounded participant
      metadata. Preserve the existing metadata endpoint contract for old clients.
- [ ] Improve backdating validation and prevent unsafe or ambiguous grant choices.
- [ ] Provide a visible contact/help path and safe password/email change guidance;
      document recovery and identity conflicts without silently merging accounts.
- [ ] Unify edit-report timezone fallback and fix deletion/recovery-address subjects.

## Deployment and operations

- [ ] Align production PostgreSQL with local/CI and its data-directory layout;
      require reviewed image versions/digests at release time.
- [ ] Align Docker Node/pnpm with the manifest, support the environment's build CA,
      and verify non-root/read-only runtime behavior and static assets.
- [ ] Configure trusted client headers explicitly for the protected Caddy topology;
      document ingress isolation and two-network acceptance.
- [ ] Add numbered bootstrap/update/rollback procedures with executable one-shot
      role/migration/grant tooling, readiness, admin promotion and first-season steps.
- [ ] Supply private backup/ledger schedules and alert procedures, including
      maintenance ordering, off-server/versioned storage and erasure-safe restoration.
- [ ] Write support procedures for verification failure, admin changes, compromised
      access, lost email/provider access, duplicate accounts and accidental erasure.
- [ ] Supply a bounded synthetic staging burst trial with disposable-target guards,
      clear measurements and resource/error acceptance criteria.
- [ ] Correct stale worker/rate-limit documentation; retain explicit monitoring,
      live providers, legal/contact and hosted performance acceptance gates.

## Verification and delivery

- [ ] Run the required aggregate checks on real disposable PostgreSQL, investigate
      every failure and unexpected skip, and add focused behavioral regressions.
- [ ] Build production web/worker; run smoke against restricted identities and
      without database configuration. Validate the production Compose/Caddy assets.
- [ ] Run relevant Playwright checks; capture and inspect affected screens in both
      themes and phone/tablet/desktop sizes. Keep artifacts outside the repository.
- [ ] Record dated evidence and unexecuted hosted checks, reconcile the QA guide
      with current behavior and provide a reusable results template.
- [ ] Review the final diff for privacy, compatibility, documentation and scope.
- [ ] Push conventional commits, create and attach a PR, inspect CI/review status
      and leave it open pending review.

## Acceptance criteria

All repository-executable fixes and required checks complete on the submitted
implementation; no private credentials or participant data in tracked files.
Manual QA has explicit cases for new behavior and unchanged security/domain
invariants. External gates remain visibly pending with executable procedures and
evidence requirements. Applied migrations are immutable; new interfaces are
additive. Readiness never implies all hosted acceptance has passed.
