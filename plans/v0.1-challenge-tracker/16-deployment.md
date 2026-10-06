# Deployment and external readiness

Status: foundation deployment tooling verified; live deployment not started. Owner role: Release/operations owner.

See [overview and gates](OVERVIEW.md), [domain rules](../../docs/domain.md) and [component index](README.md).

## Scope and dependencies

Ship reproducible web/worker units and local services before provisioning infrastructure.

Dependencies/gates: F0 containers/checks locally; E-mail/E-Google/E-Discord/E-host independently.

## Contracts and behavior

Separate local/staging/production databases, credentials and queue namespaces. Environment examples document only implemented skeleton variables; add feature secrets with their implementation. Pin runtime/package versions and lockfile. Production requires TLS, least-privilege database roles, explicit migration step, monitoring and encrypted backups. Pilot target RPO <=24h/RTO <=4h, validated by restore.

## Implementation tasks

- [x] Add foundation containers, local Compose and CI with no OAuth or hosting dependency. Web image build and both non-root entrypoints verified; feature-ready release validation remains below.
- [ ] When email is ready verify sender, delivery, verification and recovery flows.
- [ ] When portals are ready register exact callbacks, provider secrets and Discord guild commands.
- [ ] Choose host/region/budget when provisioning; deploy staging, run migration once, then compatible web/worker.
- [ ] Test restore and deletion replay, smoke enabled providers and record release evidence; use expand-contract migrations and forward fixes.

## Acceptance criteria

- Fresh install and build require no live service credentials; missing optional providers stay disabled.
- Readiness fails on unavailable database without leaking connection strings.
- Staging migration/rollback compatibility and restore meet documented targets before release.

## Progress, risks and evolution

Foundation evidence: clean web image build, non-root web/worker entrypoint smoke, PostgreSQL 17.11 and Mailpit 1.31.2 health passed. CI is configured but has not run remotely; no live deployment evidence yet. Record checked task evidence, migration impact and remaining gate here as implementation proceeds. External prerequisites block only the named live gate, never fixture/local work. Cross-component changes require integration review.

2026-10-06: reconciled with approved product review and dependency gates. Supersedes contradictory initial proposals; no deployed-data migration is needed at this planning baseline.
