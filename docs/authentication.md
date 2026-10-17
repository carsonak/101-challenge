# Authentication and privacy

Email credentials require delivery-based verification before password login. Passwords use salted Argon2id with a versioned 64 MiB, three-pass, four-lane profile following [RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html). Native asynchronous [Node Argon2](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback) is covered by the pinned runtime requirement. All hashing and verification share a process-wide two-slot gate with at most eight waiting requests; saturation returns a retryable response. Passwords and private proof values never enter logs or public projections.

Sessions, verification/recovery keys and browser OAuth state are opaque and hashed at rest. Verification expires after 24 hours, recovery after one hour, sessions after 30 days and OAuth state after ten minutes. Verification/recovery and callback state are consumed atomically. Password recovery and unlinking revoke sessions. Sensitive account changes require authentication within ten minutes and session-bound CSRF proof.

Google requests openid profile, excluding email. Browser callback failures clear binding and redirect to friendly feedback; only valid bound linking state returns to account settings. Provider transports prove stable Google/Discord subjects. Email claims never merge accounts. Linking requires a recent authenticated target session plus a fresh provider proof; a subject already owned by another account rejects. Provider-only accounts can add independently verified email credentials. Unlinking leaves at least one usable method. Optional providers remain disabled until fully configured.

`challenge_tracker_app` can append completion facts and retained revisions but cannot change them, promote users or access the deletion ledger. Local runtime selects this role through the repository's application-role mode. Deployments need a separate login inheriting this role without migration ownership or erasure privileges. Migration credentials require schema and role-management privileges; never give the public runtime a superuser login.

Owner-confirmed erasure requests require recent authentication. After the seven-day grace period, a separate privileged `eraseAccount(userId, requestId, queueSchema)` repository path validates that request and removes private inputs, histories, sign-in methods, sessions, grants and scoped jobs/events atomically. It records only a random account UUID and erasure timestamp. No email/provider fingerprint survives. Cancellation/restart never invokes erasure. The application-role repository refuses privileged privacy operations.

Trusted recovery tooling reads `deletionLedger()` from a separate privileged connection and preserves the content-free ledger independently of backups. Before restored traffic, `replayErasures(userIds, queueSchema)` removes resurrected accounts even if their requests were absent from the older snapshot. Replay is idempotent. Operational logs/backups default to 30-day retention; participant history otherwise persists until erasure. Encrypt private backups and limit operator access.

`pnpm database:migrate` applies tracked schema before local traffic. Administrator provisioning and live operator access remain deployment setup; no public role-promotion endpoint exists. Inspect private seeds only through controlled server-side database access; there is no seed debug route.

## QA account flows

Verification, password recovery and password reset have separate pages. Verification returns to login with explicit success feedback. Legacy links redirect to the appropriate page. Every password control supports reveal/hide.

Profiles store a unique username and optional avatar. Existing accounts receive a provisional handle for confirmation. Uploaded images are decoded server-side with pixel/size limits and re-encoded as 256px WebP without metadata. Sign-in history stores coarse browser/platform labels rather than raw user agents. Owners may revoke sessions individually.

A recovery address can be independently verified without creating a password. Deletion requires this address, recent authentication and the typed username. Sessions are revoked at scheduling; subsequent authentication has restricted recovery access until the fixed seven-day deadline. Ordinary core commands also reject pending-deletion accounts, including Discord actors. Restore cancels the request under the account lock and issues a new session.

Deletion emails contain a sign-in recovery method rather than a stored bearer key. The content-free delivery queue references the account and request; it retries failures with bounded backoff. Run the separate account maintenance process with privileged credentials; do not expose those credentials to the web application. Backup deletion-ledger replay bypasses grace only for identities already established as erased in the trusted ledger.

## Abuse controls

Anonymous auth actions have independent buckets; normalized email controls and authenticated-user limits are separate. Counters are bounded; production uses database time and shared opaque reservations, while isolated fixtures can inject clocks. Throttled responses provide Retry-After. Verification and recovery each reserve a fifteen-minute mail cooldown without revealing address existence. Production counters and mail cooldowns survive web replicas and restarts. The private database salt and opaque expiring keys are not readable by the application role; no plaintext identity or proof is stored. Expired buckets are removed by bounded housekeeping. Database failures fail closed. Instance/ingress caps still limit aggregate resource consumption; see [elastic hosting](elastic-hosting.md).

Forwarded client addresses are ignored unless TRUSTED_PROXY_HEADER and TRUSTED_PROXY_HOPS explicitly describe a trusted ingress. That ingress must overwrite the chosen header and prevent direct public access to the application port. With trust disabled, anonymous requests share conservative per-action local buckets; supply a verified ingress before a public pilot.

## Verification resend and credential changes

Anonymous resend_verification accepts only an address, never creates an account
and shares signup/add-email verification cooldowns across replicas. Accepted
responses do not disclose existence, verified state or SMTP failure. Addresses
are trimmed and lowercased. The verification page explains the fifteen-minute
cooldown and links from login. A failed delivery consumes its cooldown.

Authenticated change_password requires CSRF and authentication in the last ten
minutes. The account UI rechecks the current password. A successful change revokes
all sessions and outstanding credential verification/reset proofs. Reset also
invalidates outstanding credential proofs. Unlinking/replacing email invalidates
old proofs before another address is installed. Email replacement keeps the
proof-based link/unlink/add/verify workflow; recovery email remains independent.

Operator-only account suspension blocks existing/new sessions, linked Discord
lookup and tracker actions without deleting history or transferring identities.
Only privileged operators may change suspension records; runtime roles can read
them. See [support](support.md). Suspension does not defer a pending erasure.

Sensitive-action confirmation uses password proof only for verified credentials.
An unverified email is not a usable sign-in method; accounts with a retained
provider can still use recent provider proof to unlink it. Account settings show
verification status and link the resend path.
