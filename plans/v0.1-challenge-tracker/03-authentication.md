# Authentication and account linking

Status: requirements accepted; feature implementation not started. Owner role: Identity owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Email/password, Google and Discord sign-in; optional explicit account linking, no guild requirement.

Dependencies/gates: F1 locally; E-mail/E-Google/E-Discord only for live provider flows.

## Contracts and behavior

Use password hashing with Argon2id and library-reviewed parameters; verified email before public password login, expiring one-use verification/recovery tokens, opaque hashed sessions, secure HttpOnly cookies and CSRF protection. OAuth state, exact redirect allowlists, PKCE where supported, OIDC nonce/audience/issuer validation for Google. Never merge by email. A provider identity already owned by another user rejects linking; no automatic account merge. Unlink requires recent authentication and a remaining usable login method. Discord-only users can add verified email/password later.

## Implementation tasks

- [ ] Implement credentials, verification/recovery and session revocation against local mail catcher.
- [ ] Implement provider transports with fixtures and safe errors; validate configuration only for enabled providers.
- [x] Implement core explicit link/unlink flow requiring proof and recent login; map guild interactions through linked Discord identity.
- [ ] After portal gates, configure callbacks and test each live flow.

## Acceptance criteria

- Enumeration-safe responses, expired token/state rejection, replay protection and logout revocation.
- Matching emails never merge; linking conflicts and concurrent callbacks do not duplicate ownership.
- Email-only users can use every browser participant flow; no provider secrets in client bundles.

## Progress, risks and evolution

Core email verification/recovery, salted Argon2id, hashed sessions, CSRF/recent-auth checks and explicit OAuth subject linking are implemented. PostgreSQL tests use a private mail double and verified-provider proof fixtures, covering expiry, replay, revocation, independent matching-email accounts and concurrent callbacks. Live mail-catcher delivery and provider HTTP transports remain adapter work; live providers remain behind their external gates. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
