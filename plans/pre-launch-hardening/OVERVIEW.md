# Hardening overview

Owner-approved implementation is on main; local develop was fast-forwarded to the reviewed starting point. Read the [phased checklist](plan.md), [recommendation mapping](mapping.md), [accepted design](../../docs/design.md) and [dated evidence](../../docs/verification.md).

The implementation covers named verification, migration registry, OAuth/throttling/password protection, restricted database identities, queue-aware worker readiness, inbox retention, the Discord daily loop and notebook/lake web redesign. Production deployment drafts and encrypted local restore tooling are prepared for review. The authorized integrated worktree/artifact cleanup is complete; branches and source material remain preserved.

The final repository checks passed with no skipped database tests, and production-browser acceptance passed across both themes and three viewport widths. The final production build and web/worker smoke checks passed with restricted database logins and without database configuration. Local PostgreSQL and localhost browser/OAuth are the current target. Only Discord interactions use the exact-route quick tunnel. Neon remains optional. SMTP submissions succeeded, but the owner reports that neither email arrived; Brevo transactional logs identify the unchanged placeholder From address. External SMTP now rejects placeholder senders; The owner corrected the sender and a recovery retry was accepted by SMTP; The owner confirmed recovery email arrived outside spam; verification-message delivery remains unconfirmed. Discord portal signature validation succeeded. Real-provider sign-in/profile acceptance and guild command-flow acceptance are pending. Guild installation, registration and command readback succeeded. Live commands exposed an unsupported continuation-token length restriction; the fix passed focused tests and production build/smoke, and the owner confirmed help/dashboard replies. Markdown refinements are live. Windows localhost access was restored using an unreserved web port; matching provider-console callbacks and linked daily-loop acceptance remain pending. No VPS deployment, hosted-backup durability or remote CI result is claimed.

Named tests must execute and report skips accurately. Database fixtures must exercise actual restricted logins. All production routes must pass theme/viewport, accessibility, keyboard, enlarged-text, hydration and CSP checks. Record local, provider and VPS gates separately; prepared files never count as external acceptance. Artwork remains a separate initiative.

The [maintainability audit](../maintainability/OVERVIEW.md) records fresh local
acceptance and a repaired migrator erasure-role inheritance defect. Its dated
evidence supersedes earlier local checks for the refactored implementation; the
unchecked provider and deployment gates above remain separate.

## Current local readiness follow-up

The owner resolved the remaining local origin and provider-console port mismatch
and confirmed Discord login, linking Google, and recovery-address email delivery
and verification. Read-only inspection confirmed the linked identities and
verified recovery address; no password credential was inferred from that proof.
These confirmations supersede the earlier pending callback/linking statements.
Remaining provider cases and the linked Discord daily loop will be reviewed on
the owner's deployment server before additional users and Bitdevs Kisumu
installation.

Startup diagnostics now clarify the canonical website URL and worker database/job
readiness. OAuth initiation and populated-upgrade regressions protect the local
workflow; an immutable migration baseline and the [compatibility policy](../../docs/compatibility.md)
protect future changes. See the [pilot evidence map](../../docs/pilot-readiness.md)
and [dated verification](../../docs/verification.md) for local results and open
server gates. UI refinement and artwork remain later v1.0 work.

The follow-up's local acceptance is complete: aggregate checks, the populated
upgrade regression, production build, restricted/database-free smoke and all
browser scenarios passed. The dated evidence records the interrupted browser
run and the two completed acceptance groups. Server and remaining owner-assisted
gates stay open.
