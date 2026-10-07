# Phase 2: Profiles, security and recoverable deletion

Status: implemented; final verification is recorded in [OVERVIEW.md](OVERVIEW.md).

## Implementation

Case-insensitive unique usernames, provisional migration handles, provider defaults, sanitized avatars, profile menus, contextual recent authentication, owned session management, provider linking availability and a dedicated privacy page. Account deletion requires typed username, recent authentication and a verified recovery email; a retryable mail queue and restricted recovery sessions enforce the seven-day grace period. Privileged erasure remains a separate operator process.

## Acceptance and evidence

PostgreSQL tests cover username races, provider-only recovery-email verification, session ownership, delivery retry, recovery and erasure at the exact deadline. Existing authentication tests preserve proof-based linking and last-method protection. Browser tests cover typed deletion, contextual confirmation, restricted recovery, avatars and disabled provider controls.

See the [item-by-item mapping](checklist.md). Live provider configuration, production email delivery and deployment are external release checks; local provider doubles and Mailpit verify application behavior.
