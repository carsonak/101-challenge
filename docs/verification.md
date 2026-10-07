# Verification evidence

## Foundation verification

Verified on 2026-10-06 with Node 24.18.0 and pnpm 10.34.6: frozen-lockfile installation, `pnpm check`, production build, and web/worker smoke checks both without database configuration and against isolated PostgreSQL 17.11. Mailpit 1.31.2 health also passed. The web container image built from a clean dependency install, and both non-root web/worker entrypoints passed HTTP smoke checks using that image. These checks verify the skeleton only; feature acceptance tests remain unchecked in the plans. Live OAuth/email delivery and deployment were not configured or tested.

## Local tracker verification

F0–F3 verified with Node 24.18.0, pnpm 12.9.1 and PostgreSQL 17.11: `pnpm check` passed all 29 tests with no skips on a fresh disposable database, `pnpm build` passed, and built web/worker smoke passed both with migrated PostgreSQL and without database configuration. CI now enables the same real database suite instead of silently skipping integration tests.

Production-browser checks with fictional accounts passed signup and local SMTP verification/recovery, login, custom setup, reporting/editing, stale-version text retention and focused errors, cancellation/resumption/restart, admin season/template controls, one-use correction issuance/redemption, owner export, keyboard navigation and mobile widths down to 320 pixels without horizontal overflow. Provider doubles verify actual Google JWT signatures/claims and Discord stable subjects; signed guild fixtures cover private modals, actor/expiry binding, retries and failed delivery. Isolated pg-boss checks cover two workers, queue outages, publish/mark recovery, deduplication, stale projections and housekeeping. Completed-account erasure removes new adapter/worker metadata and prevents replay from restoring it.

These are local implementation checks. Live Google/Discord portals and guild registration, production sender delivery, staging load/pilot, hosted backups and a production restore remain unchecked external release gates. The [operations runbook](operations.md) describes those boundaries; no deployment or artwork runtime is claimed.

## QA initiative

Current evidence and unchecked acceptance criteria are maintained in the [QA overview](../plans/qa-improvements/OVERVIEW.md). Historical results above do not verify subsequent changes.
