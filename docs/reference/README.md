# Database and HTTP reference

- [Database schema](schema.dbml): PostgreSQL tables, columns, keys, indexes,
  checks and foreign keys after migrations `0001` through `0006`.
- [OpenAPI document](openapi.json): OpenAPI 3.1 description of the implemented
  browser API, OAuth callbacks, Discord ingress and web/worker health endpoints.

These files describe the current implementation; they do not create endpoints or
apply migrations. The [SQL migrations](../../packages/db/migrations),
[transport contracts](../../packages/contracts/src),
[HTTP dispatcher](../../apps/web/server/api.ts) and
[domain services](../../packages/core/src) remain authoritative.

## Database diagram

Open `schema.dbml` in a tool that supports [DBML](https://dbml.dbdiagram.io/docs/)
to render the relationships. It includes migration-owned tables absent from the
repository mapper: normalized report values, deletion tombstones, adapter
confirmations, event receipts, source projections and the migration ledger.
pg-boss owns its configurable queue schema; its internal tables are outside this
tracker diagram.

Composite foreign keys preserve same-owner and same-attempt relationships.
The current enrollment attempt and current goal/milestone revision references are
`DEFERRABLE INITIALLY DEFERRED`. The unique report index by attempt and reporting
index is also deferred. DBML does not encode deferrability; notes identify it.
The `attempts_one_current` index is **unique only for active or paused attempts**.
Its diagram entry carries the predicate in a note rather than claiming every
attempt for an enrollment is unique.

SQL also defines role grants, privileged erasure functions and the immutable
completion trigger, which this diagram does not implement. Completion facts may
not be updated; deletion requires authorized privileged erasure. JSON arrays and
polymorphic resource IDs are not SQL foreign keys. The deletion ledger deliberately
retains UUID tombstones without a relationship to deleted users. Read
[authentication and privacy](../authentication.md) for access and erasure rules.
DBML exports are not replacements for the tracked migrations.

## HTTP API

Import `openapi.json` into an OpenAPI 3.1 viewer or client tool. The format follows
the [OpenAPI specification](https://spec.openapis.org/oas/v3.1.0). The default web
server is `http://localhost:3000`; replace it with `APP_ORIGIN`. Worker health paths
override the server to `http://localhost:3001`; use the configured worker listener
instead when it differs. There is no hosted Swagger UI or public specification
route added by these files.

The browser API uses `challenge_session`, an HttpOnly session cookie. Anonymous
season discovery and session/provider discovery are available without it.
Authenticated reads project the caller's own data, except administrator routes,
which require administrator authorization and omit private report bodies and goal
values. History includes retained attempts, goals, revisions, milestones and owner
reports; export wraps that history with account settings and schema version 1.

All browser POST requests require `Origin` to exactly equal `APP_ORIGIN`.
Authenticated mutations also require `x-csrf-token`; obtain the current proof from
`GET /api/v1/session` or the readable `challenge_csrf` cookie. Auth and OAuth routes
mix anonymous and authenticated operations, so their OpenAPI security alternatives
must be read together with each operation's description. Cookie-authenticated
mutations cannot be exercised by supplying a bearer Authorization header.

`POST /api/v1/command` accepts a strict command object with its `command`
discriminator, resource IDs and expected versions. Every call requires an
`idempotency-key` matching `^[-\w:]{1,200}$`. Reuse a key for retries of the same
logical command. Core services reauthorize replays and return `resourceId`,
`version` and `replayed`. SubmitReport's reporting date, identity, timestamps, mode
and private seeds come from the server. Backfill and correction have explicitly
validated date fields and additional authorization. Read [domain rules](../domain.md)
and [lifecycle rules](../lifecycle.md) for eligibility and completion semantics.

For example, an authenticated enrollment request has this JSON body:

```json
{
  "command": "Enroll",
  "seasonId": "123e4567-e89b-42d3-a456-426614174000"
}
```

The UUID above is fictional; use a published season's actual ID. Include the
session cookie, Origin, CSRF proof, idempotency key and `Content-Type:
application/json` headers when submitting it.

Authentication actions include email signup/login, one-use verification/recovery,
profile changes, session revocation, notifications and account deletion recovery.
The request schema lists every supported action. Login and account restoration
can set cookies; session secrets are never returned in JSON. Sensitive account
changes, provider linking and correction-grant administration require
authentication within the preceding ten minutes. Browser JSON bodies are limited
to 2 MiB. Custom validations such as decimal digit totals, IANA timezones,
cross-field goal references and lifecycle eligibility remain enforced by the
contracts and core even where JSON Schema cannot express them fully.

Paginated collections accept only `limit` (1–100, default 25) and an opaque
collection-specific `cursor`; responses contain `items` and nullable `nextCursor`.
Sessions and notifications return arrays without pagination. Browser failures
return a typed `code`; unexpected failures return HTTP 503 with
`{"error":"Service unavailable"}`. Health readiness failures instead return
`{"status":"unavailable","service":"web"}` (or `worker`). OAuth success is a
303 redirect. Discord uses its own signed wire envelope and can return an HTTP
200 private message for a domain failure; it does not use browser cookies or CSRF.

## Maintaining the references

Update these files alongside migration, contract, projection or route changes.
Compare DBML columns, nullability, defaults, checks, indexes and composite
references against **all** applied migrations and the migration runner, including
ALTER statements. Preserve notes for constraints that DBML cannot enforce.

For OpenAPI, compare methods and paths with the dispatcher and native route
handlers, request alternatives with the shared Zod schemas, and responses with
actual safe projections. Request JSON Schemas were derived from the contracts;
custom refinements and authorization rules need manual review. These are checked-in
references, not automatically regenerated artifacts. Do not infer new API routes
from UI pages or expose server-only source snapshots.

After editing, parse DBML with a current DBML parser (use `dbmlv2` when calling
`@dbml/core`'s `Parser.parse`; the legacy `dbml` parser does not support check
blocks) and validate OpenAPI with a 3.1-compatible validator. Run
`pnpm format:check`, `pnpm lint` and
`pnpm docs:check` from the owning checkout. Application tests are unnecessary for
changes confined to these references and documentation links.
