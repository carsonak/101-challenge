# Core services

`createTracker(repository, options)` enforces authenticated ownership and lifecycle rules through a typed transaction port. Inject a clock for tests; production defaults use server time and cryptographic entropy. `execute(actorId, command, idempotencyKey)` returns safe result references. Issued correction keys appear only on the first successful issuance and are never persisted as plaintext.

Enrollment reserves the unfinished-season slot before setup. Cancellation retains progress, resumption continues it, and restart retains prior attempts. Reporting accepts distinct server-local dates; credits and report 101 completion are synchronous transactions. Goal/milestone revisions remain readable. Same-day final-report edits and scoped corrections update the latest body/source version without changing completion facts.

Owner history and metadata-only administration use separate projections. `source()` is private server-only data for future backfill and must never be attached to a browser/admin endpoint. There is no artwork runtime or credit spending.

Authentication provisions independent users separately. Runtime adapters must authenticate before calling this service; client user IDs and guild roles never establish authority.
