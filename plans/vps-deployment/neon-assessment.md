# Neon database and recovery assessment

Status: researched proposal on 2026-10-13; the owner's account, database contents and effective quotas were not inspected.

The cost comparison below describes the previous continuously polling runtime.
[ADR 0003](../../docs/adr/0003-idle-workers.md) replaces that polling with sleeping
execution; remeasure Neon usage using the [elastic-hosting acceptance checks](../../docs/elastic-hosting.md) before choosing a provider.

## Recommendation

Retain VPS PostgreSQL as the initial deployment proposal if avoiding additional recurring database spend matters. Evaluate paid Neon if managed database operation and isolation from VPS failure justify its cost. Use Neon Free for a disposable compatibility experiment rather than the continuously running pilot in its current design. The owner must select the production provider before provisioning.

Neon reduces PostgreSQL host maintenance and provides provider-managed durability and restore history. It does not eliminate application recovery procedures, independent deletion-ledger exports, off-provider recovery copies or backups of server configuration/secrets. Managed compute also introduces internet connectivity, regional latency, quotas and account/billing dependencies.

## Current free-tier fit

Neon's [2026-10-02 announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project) states that each Free project includes 1 GB database storage, 100 CU-hours per month and a six-hour instant restore window. These are dated research inputs, not stable requirements; confirm the owner's actual console entitlements and [current pricing](https://neon.com/pricing) before deciding. Older material quoting 0.5 GB or 50 CU-hours is superseded by that announcement.

At the [documented minimum compute size](https://neon.com/docs/manage/endpoints/) of 0.25 CU, continuous activity uses `0.25 × 24 × 31 = 186 CU-hours` in a 31-day month. The 100 CU-hour allowance provides 400 active hours at that size, rather than a full month. Additional active test branches share the project's budget.

This is a workload inference, not a measurement of the owner's account: the tracker polls its outbox, pg-boss polls/maintains jobs, maintenance runs every minute, and current Compose readiness checks query the database every fifteen seconds. Together they are expected to prevent the idle interval needed for [scale to zero](https://neon.com/docs/manage/endpoints/), even with few participants. A pooled endpoint does not make recurring queries idle. Measure actual compute utilization in a synthetic experiment.

Do not extend maintenance intervals or stop the worker merely to fit Free: that can break timely erasure, retries and projections. A genuinely intermittent design would need separate architectural approval and regression evidence. The free restore window is also too short to serve as the sole recovery source for mistakes discovered later.

## Comparison

| Concern                            | PostgreSQL on the VPS                                     | Neon                                                                                              |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Database administration            | Owner maintains PostgreSQL, volume, upgrades and recovery | Provider operates database infrastructure; owner still manages schema, grants and recovery        |
| Continuous worker                  | No separate compute allowance; shares VPS resources       | Budget for effectively continuous compute; Free allowance appears insufficient                    |
| VPS loss                           | Requires off-server dumps and configuration recovery      | Database survives independent VPS loss, subject to provider/account availability                  |
| Database corruption/operator error | Restore dumps and replay latest ledger                    | Provider history may speed recovery; retain ledger replay and longer/off-provider recovery source |
| Connectivity                       | Private low-latency Docker network                        | Verified TLS, remote connectivity, regional placement and reconnect behavior                      |
| Cost                               | Existing VPS plus external backup storage                 | VPS plus database usage/history/transfer and any independent archive costs                        |

## Existing setup note

The owner-provided workspace-local `neon-setup.md` contains Neon CLI installation/login, agent skill/MCP setup, project/production-branch linking, config initialization, an empty `defineConfig` and `neon deploy`. It contains no verified tracker role provisioning, migrations, queue setup or restore acceptance. Preserve its project identifiers privately.

Treat it as a tooling/linking proposal, not a completed database deployment. This repository already uses PostgreSQL via node-postgres, tracked SQL migrations and pg-boss; changing authentication to Neon Auth, deploying Neon Functions or adopting the HTTP database driver is outside this plan. Review generated files, environment loading and installed agent tools before enabling them. Do not execute a production-linked recipe during evaluation.

## Compatibility and cost evaluation checklist

- [ ] Confirm account quotas, compute sizes, restore window, storage/transfer limits and behavior when a Free limit is reached. Estimate paid monthly cost using current rates, continuously active compute, database growth, history, egress and test branches; obtain owner budget approval.
- [ ] Choose a region near the VPS and measure warm/cold connection latency, transaction time and signed Discord response deadlines.
- [ ] Use a disposable synthetic project/database whose naming satisfies repository test/restore guards. Never branch live participant data into ordinary QA or expose it to agents.
- [ ] Keep direct non-pooler verified-TLS connections for initial compatibility, particularly migrations, pg-boss and restore, as required by [deployment guidance](../../docs/deployment.md). Review [Neon pooling behavior](https://neon.com/docs/connect/connection-pooling) before considering a pooled web connection as a separate target.
- [ ] Verify custom SQL roles, capability memberships, ownership and provisioning work without actual PostgreSQL superuser access. Review [Neon role management](https://neon.com/docs/manage/roles); ensure runtime roles do not accidentally receive broad provider-management capabilities.
- [ ] Run actual restricted-login topology, transaction/migration, session advisory-lock, pg-boss startup/retry, maintenance/erasure and populated-upgrade tests on the disposable target. Do not infer compatibility merely from a successful connection.
- [ ] Check configured pools across all services and reserve connections for operator/backup jobs. Test disconnect, restart, suspend/resume and network outage recovery; confirm retry/idempotency and readiness behavior.
- [ ] Measure at least a representative period of the complete idle-but-running stack, including health checks. Project monthly CU/storage/transfer use rather than judging only browser traffic.
- [ ] Prepare a reviewed Compose variant: omit local PostgreSQL and its depends_on clauses, give web/worker/maintenance/operator jobs remote database connectivity, and retain private health ports. The draft worker currently has only an internal database network and cannot use Neon unchanged.
- [ ] Continue encrypted pg_dump and independent ledger exports to storage outside the production project's lifecycle. Verify restore tools/client versions and latest-ledger replay on a separate synthetic database.
- [ ] Evaluate managed point-in-time recovery to a separate target with traffic/workers stopped, then migrations/grants, current-ledger replay and queue reconciliation. Neon's restore can include queue state whereas the existing pg_dump excludes it; write and test the correct reconciliation procedure for each source.
- [ ] Validate provider recovery/history retention against the thirty-day limit, processing-region/legal requirements, key/account recovery and deletion behavior across branches/history. Confirm rather than assume the default settings meet the policy.
- [ ] Record an accepted provider decision and the resulting runbook/ADR, or retain VPS PostgreSQL if compatibility, cost or recovery gates fail.

## Decision gate

Neon is worthwhile when measured cost is acceptable, the full restricted-role/queue workload passes and its recovery setup reduces owner effort. Free does not currently provide a convincing production fit. A provider switch may simplify infrastructure, but backup automation and deletion-safe restore remain release requirements for either topology.
