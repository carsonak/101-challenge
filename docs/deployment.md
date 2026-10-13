# Deployment preparation

Local provider acceptance is a prerequisite for a VPS launch. The [deployment drafts](../deploy/README.md) prepare that later stage; they do not provision a server, domain, sender or storage. See [local testing](live-testing.md) and the [hardening gates](../plans/pre-launch-hardening/OVERVIEW.md). Do not execute the external Neon recipe.

## Database ownership

Use a separate PostgreSQL database per environment. Local setup uses `.env` and `.env.operator` with matching examples and a scoped launcher; see [configuration](configuration.md). Provision roles, migrate with MIGRATOR_DATABASE_URL, then provision grants. Production entrypoints receive the same named settings from private scoped process environments. Use unique strong passwords and URL-encode connection components.

The migrator owns application objects and can create the shared NOLOGIN capability roles. The web login inherits only challenge_tracker_app. The worker has narrow outbox/projection/expiry privileges and retains ownership of its legacy queue schema for compatibility; production no longer initializes pg-boss. The maintenance login receives the erasure capability and account-mail access. Runtime logins are nonsuperusers without role-management privileges. The operator and migration environments are never loaded by the public web runtime. Inspect actual login privileges with the topology regression; do not substitute SET ROLE from an owner connection for that check.

Local commands select web DATABASE_URL and WORKER_DATABASE_URL from .env and maintenance ERASURE_DATABASE_URL from .env.operator. Production keeps separate service environments. Do not include Discord's registration bot token in any runtime file. Queues and migrations must be ready before admitting traffic. Worker readiness checks tracked migrations. Sleeping sweeps use bounded batching and failure backoff, with shutdown awaiting the active sweep.

## Ingress and server prerequisites

Before using the production Compose example, establish the VPS, firewall, domain/DNS, TLS, dedicated operator access, external backup storage and authenticated sender. Confirm SPF/DKIM/DMARC and delivery with the mail provider. Owner legal-review gate: verify terms/privacy, local data-protection obligations and any cross-border processing with qualified advice before participant release. Review the terms/privacy copy with the owner and configure CONTACT_EMAIL. Provide the exact HTTPS APP_ORIGIN and provider callbacks. Keep PostgreSQL and worker health ports private. Caddy must overwrite X-Forwarded-For and the web port must be unreachable directly before enabling TRUSTED_PROXY_HEADER=x-forwarded-for and TRUSTED_PROXY_HOPS=1. Otherwise leave forwarded-address trust disabled.

Compose resource/log limits are starting values requiring measurement on the actual server. Alert on failed readiness, queue outages, oldest pending events, unsent account notices and erasure requests more than five minutes overdue. The maintenance scheduler sleeps until work is due, with coarse recovery scans and separate credentials. See [elastic hosting](elastic-hosting.md) for autoscaling and request-mode execution. Inspect proxy and runtime logs for proof-bearing URL leakage before launch. Do not retain operational logs or backups beyond thirty days.

## Backups and isolated restore

Use pg_dump custom format, age public-recipient encryption and configurable S3-compatible storage. Keep age decryption identities off the server. Retain the current deletion ledger independently of any historical dump and back it up frequently; a restore must use the latest ledger, not merely the ledger inside the old snapshot. Configure storage lifecycle to expire backups after at most thirty days. Upload requires its own storage principal; restrict reading/decryption to restore operators.

Restore into an empty, exclusive database with workers and traffic stopped. Local tooling deliberately requires an isolated `_restore_test` name; participant restore requires a separately reviewed operator procedure. Decrypt off the server, restore without inherited ACL/ownership, apply tracked migrations and grants, and replay the newest deletion ledger using the private restore tool. Test synthetic sign-in/reporting, completion/seed invariants, erasure and readiness, then record restore duration and safe counts. The local rehearsal exercises actual encrypted pg_dump/restore and newest-ledger replay on synthetic data; it does not establish hosted encrypted storage durability or VPS disaster recovery. Legacy pg-boss tables are excluded; the transactional outbox is retained and restored work is reprocessed with receipts before readiness acceptance. Neither successful preparation nor a Compose syntax check authorizes deployment.

## Optional Neon compatibility

Use verified-TLS PostgreSQL connections. Keep a direct connection for migrations
and restore. Runtime work uses short transactions and transaction-scoped advisory
locks; no LISTEN connection or pg-boss background session runs. Test a provider's
transaction-pooler semantics on an isolated database before adopting it. Confirm
restricted role grants and SECURITY DEFINER functions work without superuser
assumptions. Bound total connections across replicas and measure database suspension,
cold starts and Discord deadlines. The PostgreSQL HTTP driver is not a drop-in
replacement for this repository's transaction API. See [elastic hosting](elastic-hosting.md).

Provisioning explicitly grants inherited erasure-role usage to the migrator and
maintenance login. PostgreSQL grants non-inheriting membership to a non-superuser
role creator by default; the migrator-owned SECURITY DEFINER erasure function must
inherit usage for its immutable-completion deletion guard. Reapply the normal
`pnpm database:provision grants` step with operator credentials to repair an
existing configured stack. No schema migration or completion-guard relaxation is
required. See [PostgreSQL role attributes](https://www.postgresql.org/docs/17/role-attributes.html).
