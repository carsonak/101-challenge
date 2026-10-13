# Tracker worker

The worker requires applied tracker migrations. It directly processes leased
content-free outbox events with receipt deduplication, and performs bounded
proof/replay/inbox housekeeping. Completion remains synchronous.

Use `pnpm dev:worker` or `pnpm start:worker`. Resident mode sleeps between persisted
deadlines and coarse recovery sweeps. Request mode runs a bounded sweep on signed
private POST /wake and requires external durable scheduling. `pnpm start:worker
--once` runs a sweep and exits. No pg-boss polling, reminder or artwork handlers
start. Shutdown awaits active work before releasing connections.

See [elastic hosting](../../docs/elastic-hosting.md),
[configuration](../../docs/configuration.md) and
[operations](../../docs/operations.md) for wake keys, recovery and deployment gates.
