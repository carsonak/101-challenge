# Account model and review follow-up

Status: accepted owner requirements; implementation in progress. Continues
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

- [ ] Append migration and align contracts/OpenAPI, service and provider adapters.
- [ ] Implement optional-email signup, username login, provider setup and settings.
- [ ] Align durable account/privacy/manual-QA/support documentation and TODOs.
- [ ] Test absent/unverified/verified emails, email collisions, stale proofs,
      provider setup, password additions, username changes and populated upgrades.
- [ ] Run aggregate PostgreSQL checks, production build and focused browser tests;
      inspect both themes and mobile/desktop screenshots using synthetic data.
- [ ] Commit conventional changes, update the existing PR, await review.

Hosted OAuth/inbox and VPS acceptance remain separate release gates; no merge or
deployment is authorized by completion of this follow-up.
