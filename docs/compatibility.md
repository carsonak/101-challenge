# MVP compatibility and upgrades

The tracker contracts are the baseline for the first hosted pilot. The
[domain rules](domain.md), [authentication policy](authentication.md),
[transport schemas](../packages/contracts/src), [database reference](reference/schema.dbml)
and [OpenAPI reference](reference/openapi/openapi.yaml) describe the supported
behavior. The [pilot checklist](pilot-readiness.md) separates local verification
from acceptance on the deployment server. UI refinement and artwork generation
must preserve the tracker baseline.

## Changes after the pilot

Preserve existing accounts, provider ownership, enrollment and reporting history,
completion entitlements, deterministic seed facts and erasure semantics. Keep
private projections private. Default to additive changes and preserve existing
request/response meanings, field types, command names and lifecycle transitions.
New optional request fields need defaults that preserve existing clients. Do not
silently make an optional field required or reinterpret persisted values.

A necessary breaking API change requires an explicitly reviewed versioned
interface, a compatibility period and a client migration plan. Breaking domain
or storage changes require a separately reviewed data transition and recovery
strategy. This policy does not promise every internal TypeScript symbol is a
public API. Existing authentication/tracker facades remain compatibility surfaces
for repository adapters.

## Applied migrations are immutable

Migrations are ordered and append-only. The reviewed MVP files and SHA-256 hashes
are recorded in [the baseline](../tests/fixtures/mvp-migrations.json); the
[regression](../tests/mvp-compatibility.test.ts) permits appended migrations but
rejects edits, removals and reordering of existing ones. Do not refresh that
baseline to make a historical migration edit pass. Fix historical defects with a
new migration. This baseline is a repository guard, not a replacement for backup
or verification of the migration ledger on a deployed database.

Every new migration needs a populated upgrade fixture from the current deployed
baseline, including account links, reports/revisions, completion and seed facts.
Keep the existing legacy upgrade test. Update references alongside reviewed
schema or API additions and validate against runtime contracts; references alone
do not change behavior.

## Upgrade procedure

1. Review compatibility, migration lock/runtime cost and whether old and new
   application versions can coexist. This project uses one web process; avoid
   traffic during incompatible transitions.
2. Produce an encrypted backup and preserve a current deletion ledger separately.
   Restore into an isolated database and replay erasures before serving traffic,
   following [operations](operations.md).
3. Apply migrations to the restored disposable copy using the migrator login.
   Verify restricted permissions, identity links, history, completion/seed facts,
   web/Discord commands and worker readiness. Reconcile references and document
   the recovery strategy before the real upgrade.
4. Stop affected traffic/workers, apply migrations with the dedicated migrator,
   then start the compatible web, worker and maintenance versions. Verify
   readiness, login and a synthetic report before reopening traffic.
5. Roll back application code only when the reviewed schema and persisted states
   support that version. Otherwise roll forward with a fix. Restoring a backup
   must account for newer accepted reports and the latest deletion ledger;
   never overwrite new participant data as routine rollback.

Record deployed version, migration range, verification and recovery evidence
without credentials or participant text. Production backups and a tested server
restore remain release gates rather than assumptions implied by local tests.
