# Tracker worker

The worker requires the applied tracker migrations before registering pg-boss handlers. It publishes leased content-free outbox events, checks source projections with receipt deduplication and performs hourly proof/replay housekeeping. Queue failures do not undo reports or synchronous completion.

Use the root `pnpm dev:worker`/`pnpm start:worker` commands with an exclusive database and `QUEUE_SCHEMA`. No artwork or reminder handlers are installed. Shutdown stops publishing and handlers before releasing connections. See [operations and recovery](../../docs/operations.md) for retention, terminal failure inspection and restore requirements.
