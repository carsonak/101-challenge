# Account model and review follow-up

Status: accepted owner requirements; implementation and local acceptance complete; PR review pending. Continues
[PR #2](https://github.com/carsonak/101-challenge/pull/2) against main using the
[carsonak workflow](../../docs/workflows/carsonak.md).

## Requirements and design

Username/password is the default. Recovery email is optional, verified before
email-alias login or recovery, and recommended on every account-settings visit.
A verified recovery address uses the same password for login; Google/Discord
remain independent subject-based identities and never merge by email. Google
requests verified email and requires a username setup step. Discord supplies a
URL-safe unique username when possible; collision/invalid suggestions require
setup. Both provider-only accounts may set passwords without adding email.
Usernames use 3–40 ASCII letters, digits, underscores or hyphens, normalized to
lowercase; spaces are rejected. Settings allow username, recovery email and
password changes with recent authentication for sensitive changes.

Preserve existing hashes, email login payloads, provider subjects, sessions and
participant history. Append migration 0010; never alter applied migrations.
Recovery address collisions must fail closed, including legacy duplicate recovery
addresses; no matching-address identity merge. Stale email/reset proofs must not
restore removed addresses or replace passwords after credential changes.

There is no participant correction-request or ticket interface. Keep admin-issued
keys and owner redemption, with no promise of staffed support. Mark deferred
artwork/reward wording adjacent to its source with the workflow TODO convention.
Keep verification mail kinds explicit; verification remains supported.

## Execution and acceptance

- [x] Append migration and align contracts/OpenAPI, service and provider adapters.
- [x] Implement optional-email signup, username login, provider setup and settings.
- [x] Align durable account/privacy/manual-QA/support documentation and TODOs.
- [x] Test absent/unverified/verified emails, email collisions, stale proofs,
      provider setup, password additions, username changes and populated upgrades.
- [x] Run aggregate PostgreSQL checks, production build and focused browser tests;
      inspect both themes and mobile/desktop screenshots using synthetic data.
- [x] Record conventional commits and prepare the existing PR update.
- [ ] Receive review approval; leave the PR open without merging or deploying.

Hosted OAuth/inbox and VPS acceptance remain separate release gates; no merge or
deployment is authorized by completion of this follow-up.

## Verified outcome

Username/password, optional verified email aliases, provider defaults, required
Google username setup and account settings are implemented. Verification mail
retains all four explicit kinds. Adjacent TODO markers cover deferred artwork
copy and contracts; no correction-request UI was added. The carsonak workflow
records the marker convention.

Security review additionally closed a provisional-account mutation bypass,
modern HTML pattern syntax failure, recovery-address races/legacy ambiguity and
a reset path that could mark a different pending legacy email verified.

See the dated [verification record](../../docs/verification.md) for aggregate,
browser, image, bootstrap and default-account trial evidence. Hosted provider
consent/inbox and VPS/manual acceptance still require their documented pass.
