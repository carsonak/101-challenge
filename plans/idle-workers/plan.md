# Implementation plan

## Goal

Stop empty queue polling, allow PostgreSQL to suspend between bursts, and support
both resident workers and request-scoped execution on elastic platforms. Preserve
transactional reports/completion, authentication, erasure deadlines and privileges.

## Design

- Use the existing transactional outbox as the durable work queue. Process it
  directly with leases and receipts instead of continuously polling pg-boss.
  Recover published legacy events that have no processing receipt during upgrade.
- Wake restricted workers after committed work through optional signed internal
  HTTP requests. Accept no job payload, user ID, SQL or destination from callers.
  Bound and coalesce wake-ups; preserve queued work when delivery fails.
- Sleep until the earliest persisted retry/deletion deadline. Adapt batching and
  housekeeping within configured bounds; recover missed signals on startup and
  coarse scheduled sweeps. Never extend a deadline due to inactivity.
- Offer resident timer execution and request-scoped bounded sweeps plus one-shot
  commands. External durable scheduling is mandatory when processes may suspend;
  in-memory timers are never represented as durable platform scheduling.
- Keep erasure/mail credentials outside web and projection workers. Use database
  database-free liveness probes routinely; retain deliberate migration-aware readiness.
- Persist bounded opaque abuse counters across web replicas/restarts. Preserve
  strict forwarding trust, expiry-at-use, CSRF and synchronous completion.
- Filter expired inbox notices on reads, and improve cold-start web/Discord copy.

## Steps and acceptance

- [x] Inspect code, policies and main baseline; create feature branch.
- [x] Implement durable queues, wake protocol and adaptive scheduler.
- [x] Implement shared abuse controls and cold-start handling.
- [x] Update deployment, configuration, ADR and migration references.
- [x] Verify empty-idle query silence, deadlines, missed pokes, failure backoff,
      concurrent sweeps, shared limits, upgrade compatibility and restricted roles.
- [x] Run aggregate checks, build, smoke and synthetic browser/theme checks.
      Delivery uses `feat/idle-aware-workers`, targeting `main` directly. Publication is recorded by the branch and PR history.

## Hosting acceptance still required

No provider or account is selected by this change. Hosted release must verify
external scheduler delivery, execution timeout/CPU policy, Discord acknowledgement
latency, private service ingress, instance/connection caps, Neon idle compute,
backups and deletion-ledger export. These are deployment gates, not local-test claims.

## Local verification — 2026-10-13

- `pnpm check`: type checks, lint, formatting, source boundaries, documentation,
  OpenAPI, and 84 tests passed with no skipped database tests.
- `pnpm build` and production web/worker smoke passed with restricted logins.
- All 11 Chromium browser tests passed, including OAuth, account recovery,
  reporting, accessibility, CSP and cold-start feedback.
- Inspected synthetic loading screenshots in light/dark themes at phone and
  desktop widths. Slow form submissions retain inputs and do not auto-resubmit.
- Real PostgreSQL tests cover populated upgrade, shared limits across replicas,
  lease takeover, duplicate sweeps, cleanup batching, persisted deadlines and
  post-commit hints. Deterministic clocks verify idle silence and failure backoff.

No hosted provider, Neon account, external scheduler or production database was
changed. Actual suspension, billing and platform deadline delivery remain hosted
acceptance checks above.
