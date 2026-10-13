# Pre-launch hardening checklist

Owner-approved implementation on main. Checked items describe implemented behavior; acceptance evidence and external gates are tracked separately in [OVERVIEW.md](OVERVIEW.md) and [verification](../../docs/verification.md). Preserve completion facts, deterministic seeds, retained history and erasure semantics. The external Claude source material remains preserved in the workspace.

## Stage 1 — Baseline and cleanup

- [x] Serial named test execution with isolation disabled; regression proves an intentional temporary failure exits unsuccessfully, locally and in CI.
- [x] Format the frontend skill without changing its instructions; consolidate plans and accepted design brief; repair branding and malformed Markdown references.
- [x] Export one ordered migration registry, use it for execution and both readiness paths, and test file consistency and upgrades.
- [x] Fast-forward develop to the reviewed starting main; remove only the two authorized integrated clean worktrees and four completed artifact groups after host process/mount/reachability checks. Keep branches, permanent checkout, workspace guide, private configuration and Claude sources.
- [x] Mark historical evidence explicitly and replace duplicated current-state counts with links to authoritative files.
- [x] Final formatting, documentation, boundaries, typechecking and named database-backed suite acceptance after all changes.

## Stage 2 — Authentication and database correctness

- [x] Google OpenID/profile scopes excluding email; validated Google avatar hosts; safe OAuth callback redirects, cookie clearing, request IDs and bound linking destinations.
- [x] Independent action/email/user throttles with opaque bounded keys, injectable clocks and retry hints; forwarded addresses ignored unless explicitly configured behind a protected ingress.
- [x] Enumeration-safe verification/recovery cooldowns and process-wide bounded Argon2 active/waiting capacity across all password paths.
- [x] Separate nonsuperuser migrator, web, worker and maintenance provisioning; actual-login regression checks migrations, denied privileges, queue work, housekeeping and account erasure.
- [x] Configurable outbox idle backoff, non-overlapping scans, graceful shutdown and queue-aware readiness.
- [x] Stop inbox entries for routine self actions; retain system/admin notices with named read/dismissed and unread retention policies and boundary tests.
- [x] Lightweight owner-authorized Discord summary with metadata-only historical reporting dates and today's exact accepted report revisions.
- [x] Measure full-attempt history, summary and admin responses on synthetic data; preserve benchmark evidence separately from performance guarantees.
- [x] Final restricted-login, retention, outage, retry, race and upgrade regression acceptance.

## Stage 3 — Discord daily loop

- [x] Five shared commands: dashboard, report, seasons, join, help; autocomplete, contextual resource selection and private buttons.
- [x] Recommended and simple custom setup; today report/edit, progress, pause/resume; website links for complex revisions, backfill and destructive lifecycle actions.
- [x] Immediate labelled modals, nested text/checkbox parsing and a deadline below Discord's initial response limit; no late domain mutation after timeout.
- [x] Before submission, redirect oversized forms to the website; preserve every required goal value and applicable manual milestone.
- [x] Actor/resource/version/expiry-bound component state, additive kind migration and idempotent deliveries.
- [x] Shared friendly errors and complete escaped private recovery chunks with mentions disabled; no report text in metadata/events/logs.
- [x] Guild registration defaults to dry-run; global writes require an explicit switch; bot token stays outside web runtime configuration.
- [x] Final fixture acceptance for component shapes, deadlines, limits, foreign/expired forms, duplicate deliveries and recovery.
- [x] Live portal interaction validation records a successful signed request through the exact-route tunnel.
- [x] Live guild registration and readback after owner installation.
- [x] Owner confirms live help/dashboard replies after continuation-token fix.
- [ ] Owner exercises linked join/report/edit/pause/resume flows during the hosted review; local browser access and corrected provider callbacks are confirmed.

## Stage 4 — Web security and redesign

- [x] Nonce CSP via Next Proxy, theme script nonce and dynamic pages; restrictive permissions/referrer policies and HTTPS-only HSTS.
- [x] Route metadata, icon, skeletons, not-found/error boundaries; terms and accurate privacy with optional contact and private owner legal-review guidance.
- [x] Split tracker controller/forms/screens and use targeted fetch refreshes while preserving unsaved drafts and typed destructive confirmations.
- [x] Tailwind semantic themes, Radix profile menu and one icon set; licensed self-hosted Fraunces and Source Sans 3; left-aligned notebook/lake surfaces and 101-cell progress signature.
- [x] Authentication, Home, challenge/setup, seasons, account, history/notifications and admin route migration; retire legacy styling.
- [x] Static today outline; only user-triggered animation with reduced-motion support. Avatar proxy optimization remains deferred pending measurement.
- [x] Final browser matrix: all routes, both themes, phone/tablet/desktop, keyboard, narrow/enlarged text, accessibility, hydration and CSP violations; screenshot review.

## Stage 5 — Local live tests and later VPS preparation

- [x] Production localhost app with private isolated PostgreSQL, restricted worker and separate privileged maintenance; personal account data stays outside synthetic test artifacts.
- [x] Exact POST-only loopback Discord proxy with signed raw-byte preservation, body/time bounds and rejection of all other routes/methods/query variants.
- [x] Temporary quick tunnel targets the proxy; APP_ORIGIN, OAuth callbacks and Discord website links remain localhost and owner-machine only.
- [x] Validate ignored Google/Discord/Brevo configuration without disclosure; Brevo TLS/authentication and two owner-authorized verification/recovery SMTP submissions pass.
- [x] Owner confirms corrected recovery-email delivery to the inbox, outside spam.
- [x] Owner confirms Discord login, Google linking and recovery-address delivery/verification after correcting provider-console callback ports.
- [ ] Password-signup verification delivery, remaining provider first/repeat login, cancellation/conflict/profile cases and linked guild daily flows; complete during owner-assisted/hosted acceptance.
- [x] Optional Neon compatibility checklist; supplied recipe is not executed.
- [x] Prepare reviewable production Compose/Caddy, isolated maintenance scheduling, resource/log limits and pg_dump/age/configurable S3 backup tooling; no VPS action performed.
- [x] Isolated encrypted local restore with latest post-snapshot deletion-ledger replay preserves retained completion/seed facts and removes erased identities.
- [x] Final production build and web/worker smoke with restricted database logins and without database configuration; Compose/Caddy and worker packaging validation are recorded.
- [ ] Remote storage durability, server restore, sender authentication, domain/firewall and resource sizing remain external release gates.

## Acceptance boundary

All local gates must pass on the final implementation. Database-backed tests must report no unexpected skips and exercise real restricted logins. Provider, encrypted-storage and VPS evidence are distinct from fixture acceptance and prepared assets. No commit, push, merge, provision or deployment is implied by this checklist.

## Local readiness and compatibility follow-up

- [x] Canonical browser URL guidance and worker startup readiness diagnostics.
- [x] OAuth initiation regression coverage with fictional providers; immutable MVP migration baseline and populated upgrade regression.
- [x] Durable [compatibility policy](../../docs/compatibility.md) and [pilot evidence map](../../docs/pilot-readiness.md).
- [x] Fresh local aggregate checks, production build/smoke and browser/theme/accessibility acceptance; see [dated evidence](../../docs/verification.md).

The owner sets up hosting next and performs a thorough web/Discord path review
before inviting users or installing on Bitdevs Kisumu. UI refinement and artwork
are deferred toward v1.0; future additions must preserve core workflow contracts
and existing participant data.
