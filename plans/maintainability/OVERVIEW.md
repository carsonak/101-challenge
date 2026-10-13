# Maintainability overview

The production code is split behind compatible public entrypoints, bespoke UI
styles use CSS Modules alongside Tailwind, statement spacing and 300-line file
limits are enforced, and the API reference is modular YAML managed by Redocly.
Read [the checklist](plan.md) and [dated evidence](../../docs/verification.md).

The audit exposed a PostgreSQL role-inheritance defect: the migrator could lack
inherited erasure-role usage, preventing removal of completed accounts through
its SECURITY DEFINER function. Provisioning now grants inheritance explicitly;
restricted-login acceptance covers an actual 101-report completion and erasure.
The completion immutability guard is preserved.

Fresh aggregate checks passed with 66 named tests and no failures or skips. The
production build, restricted-login and database-free smoke passed. Eight browser
tests passed without retries, including 120 route/theme/viewport combinations,
accessibility, keyboard/enlarged text, hydration/CSP and synthetic screenshot
review. The CSS layer-order regression discovered during verification was fixed
before this acceptance run.

The fresh encrypted restore rehearsal preserved 101 reports and completion/seed
facts, replayed the newer deletion ledger and refused a populated restore target.
Public authentication/tracker factory types remain assignable in both directions
against the original contracts; compiled local package imports have no cycles.

Live provider acceptance remains distinct. The installed foreground cloudflared
uses the exact-route proxy; no system service or full-site tunnel is required.
Provider-console callbacks have now been corrected; the owner confirmed Discord
login, Google linking and recovery-address delivery/verification. Remaining
provider cases, password-signup verification delivery and linked Discord daily
flows await the owner's hosted review. The private project database is
healthy on the selected alternate port, with aligned runtime/operator targets and
separate restricted logins. Local web/worker readiness passed; public unsigned
Discord POSTs return 401 and root/GET/query variants return 404. Registration
dry-run passed. No unrelated database has been altered. VPS and hosted-backup
gates remain pending.

## MVP readiness follow-up

The local sign-in failures were caused by a browser-origin mismatch followed by
stale provider-console callback ports. The follow-up adds canonical-URL startup
guidance, explicit worker startup readiness, browser OAuth initiation regressions,
an immutable migration baseline and a populated MVP upgrade regression. Fresh
acceptance is recorded in [verification](../../docs/verification.md).

The [compatibility policy](../../docs/compatibility.md) governs later changes; the
[hosted pilot checklist](../../docs/pilot-readiness.md) maps core workflows to
evidence and the owner's server review. Hosting, additional users and Bitdevs
Kisumu installation follow that review. UI refinement and artwork remain later
v1.0 work.

The follow-up's local acceptance is complete: aggregate checks, the populated
upgrade regression, production build, restricted/database-free smoke and all
browser scenarios passed. The dated evidence records the interrupted browser
run and the two completed acceptance groups. Server and remaining owner-assisted
gates stay open.
