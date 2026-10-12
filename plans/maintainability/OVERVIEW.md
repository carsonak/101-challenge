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
Owner confirmation of provider-console callbacks, verification-email delivery,
and linked Discord daily flows is still pending. The private project database is
healthy on the selected alternate port, with aligned runtime/operator targets and
separate restricted logins. Local web/worker readiness passed; public unsigned
Discord POSTs return 401 and root/GET/query variants return 404. Registration
dry-run passed. No unrelated database has been altered. VPS and hosted-backup
gates remain pending.
