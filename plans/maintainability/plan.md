# Audit completion and maintainability

Work directly on main while preserving unrelated edits. No commits, pushes, merges or deployments are included. Retain licensed local fonts and Tailwind semantic utilities.

## Progress

- [x] Audit baseline: local checks, build and database-free smoke passed; database acceptance was skipped and external gates remain pending.
- [x] Split production code by responsibility, preserve public facades and keep handwritten production code at 300 physical lines or fewer.
- [x] Move bespoke component styles into CSS Modules, preserving the accepted design and cascade.
- [x] Enforce statement-only TypeScript spacing with AST-aware formatting and line-limit checks.
- [x] Convert OpenAPI to referenced YAML managed by pinned Redocly; verify contract equivalence and correct documented drift.
- [x] Verify restricted-login PostgreSQL behavior, production build and smoke, browser accessibility, CSP, hydration and synthetic screenshots.
- [x] Prepare owner-assisted provider acceptance using the installed foreground cloudflared and the exact-route Discord proxy.

## Acceptance

Preserve authorization, transaction boundaries, lock order, retries, idempotency, clock/entropy ownership, completion and seed facts, private projections and mail-after-commit semantics. Compatibility facades preserve existing imports and public wire contracts. Tests have no strict line ceiling, but feature-specific test groups may be split.

Fresh checks must distinguish local evidence, historical evidence and external acceptance. Database tests must execute with no unexpected skips on disposable PostgreSQL using real restricted logins. Browser checks cover both themes, narrow/tablet/desktop widths, keyboard and enlarged text, draft retention, stale cookies, accessibility, CSP and hydration. Keep all raw verification and synthetic screenshots outside repositories.

Live OAuth, verification-message delivery and Discord join/report/edit/pause/resume require owner interaction. Hosted backup durability, VPS deployment and server restore remain separate release gates. Installation of cloudflared is already complete; service installation is unnecessary.

## Verified findings

The restricted-login audit found and repaired non-inheriting migrator erasure-role
membership. The topology regression now completes 101 reports and verifies actual
maintenance erasure. No schema migration or relaxation of the completion guard
was introduced. API conversion preserves every original component and operation
contract except the reviewed stale-session description and unreachable GET error
responses. The YAML union regression checks both runtime command registries.

The initial CSS migration exposed layer-order resets; each module now declares
the shared layer order, and low-specificity base button/dialog styles preserve
component overrides. Final browser verification and synthetic screenshot review
passed after that correction. See [the overview](OVERVIEW.md) for current live gates.
