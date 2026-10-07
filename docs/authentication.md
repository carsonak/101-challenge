# Authentication and privacy

Email credentials require delivery-based verification before password login. Passwords use salted Argon2id with a versioned 64 MiB, three-pass, four-lane profile following [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html). Native asynchronous [Node Argon2](https://nodejs.org/download/release/v24.16.0/docs/api/crypto.html#cryptoargon2algorithm-parameters-callback) requires Node 24.7 or newer. Passwords and private proof values never enter logs or public projections.

Sessions, verification/recovery keys and browser OAuth state are opaque and hashed at rest. Verification expires after 24 hours, recovery after one hour, sessions after 30 days and OAuth state after ten minutes. Verification/recovery and callback state are consumed atomically. Password recovery and unlinking revoke sessions. Sensitive account changes require authentication within ten minutes and session-bound CSRF proof.

Provider transports prove stable Google/Discord subjects. Email claims never merge accounts. Linking requires a recent authenticated target session plus a fresh provider proof; a subject already owned by another account rejects. Provider-only accounts can add independently verified email credentials. Unlinking leaves at least one usable method. Optional providers remain disabled until fully configured.

`challenge_tracker_app` can append completion facts and retained revisions but cannot change them, promote users or access the deletion ledger. Local runtime selects this role through the repository's application-role mode. Deployments need a separate login inheriting this role without migration ownership or erasure privileges. Migration credentials require schema and role-management privileges; never give the public runtime a superuser login.

Owner-confirmed erasure requests require recent authentication. After the seven-day grace period, a separate privileged `eraseAccount(userId, requestId, queueSchema)` repository path validates that request and removes private inputs, histories, sign-in methods, sessions, grants and scoped jobs/events atomically. It records only a random account UUID and erasure timestamp. No email/provider fingerprint survives. Cancellation/restart never invokes erasure. The application-role repository refuses privileged privacy operations.

Trusted recovery tooling reads `deletionLedger()` from a separate privileged connection and preserves the content-free ledger independently of backups. Before restored traffic, `replayErasures(userIds, queueSchema)` removes resurrected accounts even if their requests were absent from the older snapshot. Replay is idempotent. Operational logs/backups default to 30-day retention; participant history otherwise persists until erasure. Encrypt private backups and limit operator access.

`pnpm database:migrate` applies tracked schema before local traffic. Administrator provisioning and live operator access remain deployment setup; no public role-promotion endpoint exists. Inspect private seeds only through controlled server-side database access; there is no seed debug route.

## QA account flows

Verification, password recovery and password reset have separate pages. Verification returns to login with explicit success feedback. Legacy links redirect to the appropriate page. Every password control supports reveal/hide.

Profiles store a unique username and optional avatar. Existing accounts receive a provisional handle for confirmation. Uploaded images are decoded server-side with pixel/size limits and re-encoded as 256px WebP without metadata. Sign-in history stores coarse browser/platform labels rather than raw user agents. Owners may revoke sessions individually.

A recovery address can be independently verified without creating a password. Deletion requires this address, recent authentication and the typed username. Sessions are revoked at scheduling; subsequent authentication has restricted recovery access until the fixed seven-day deadline. Ordinary core commands also reject pending-deletion accounts, including Discord actors. Restore cancels the request under the account lock and issues a new session.

Deletion emails contain a sign-in recovery method rather than a stored bearer key. The content-free delivery queue references the account and request; it retries failures with bounded backoff. Run the separate account maintenance process with privileged credentials; do not expose those credentials to the web application. Backup deletion-ledger replay bypasses grace only for identities already established as erased in the trusted ledger.
