# Database boundary

`createDatabase` supplies foundation readiness and Drizzle access. `createRepository` implements the core transaction port using Drizzle parameterized SQL over PostgreSQL, typed columns, binary private entropy, UTC timestamps and SQL reporting dates. Await `close()` on shutdown.

Call `migrate()` using the schema owner before starting application traffic. The clean initial migration is serialized by a transaction advisory lock and recorded in `tracker_migrations`. It creates retained attempts/revisions/reports, same-attempt composite references, the unique unfinished-season slot, completion entitlement, grant hashes, safe replay references, audit and outbox. No production migration from deployed tracker data is assumed.

`TRACKER_TEST_DATABASE_URL` enables real transaction tests and must name a disposable database ending in `_test` or `_ci`. Tests create fictional accounts and never target participant data. Missing configuration skips this suite; release evidence requires an explicit passing database run.

Identity migration adds the restricted application role, independent credentials/provider subjects, sessions and one-use proofs. Privileged erasure validates an owner request and records content-free tombstones; restore replays them before traffic. See [authentication/privacy](../../docs/authentication.md). Ordinary repository operations reject entitlement/revision updates. Credentials and migrations must remain server-only.
