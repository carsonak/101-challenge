# v0.1 implementation overview

Baseline: 2026-10-06. Contracts, transactional domain, identity/privacy, browser/Discord adapters and workers implemented; F0–F3 verified locally; live release gates remain. The repository foundation is tracked separately in the root README. [Domain rules](../../docs/domain.md) are authoritative.

## Dependency gates

| Gate                | Work unlocked                                       | Required evidence / external dependency                                                    |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| F0 Foundation       | Package work and fixture-based adapter development  | Install, checks, build, local services; no external credentials                            |
| F1 Contracts        | Domain, web and Discord workstreams                 | Shared command schemas, state matrix, source fixtures and schema review                    |
| F2 Domain           | Adapter integration and live artwork source gate A1 | Accounts, slot/lifecycle, goal revisions, reports, seeds/perks and PostgreSQL transactions |
| F3 Integrated local | Live service smoke tests                            | Browser/Discord parity, correction grants, completion, privacy, worker retry tests         |
| E-mail              | Public email account use                            | Verified sender/domain, delivery, verification/recovery smoke tests                        |
| E-Google            | Live Google login                                   | Provider app, callback allowlist and credentials                                           |
| E-Discord           | Live Discord login and guild commands               | Developer application, callback, public key, guild install and command registration        |
| E-host              | Staging operations                                  | Server/provider, DNS/TLS, database, secret storage, monitoring and backups                 |
| Release             | Public tracker                                      | F3, email and enabled-provider gates, staging pilot and restore evidence                   |

No external gate blocks F0–F3: use mail catcher, OAuth transport doubles, signed request fixtures and typed UI fixtures. Disabled providers must not break local startup. Full advertised Google/Discord support requires their live gates before the v0.1 release; deployments may temporarily hide them during development.

## Execution order and ownership

The integration owner coordinates contracts/migrations. Role names are responsibilities, not authorization for agents. Domain order: identity → user slot/enrollment → initial setup/seeds/revisions → reports/milestones/perks → completion/corrections. Web and Discord can work against F1 fixtures. Operations can build containers and retry tests after F0. Combine changes at F3 before provisioning gates.

[Artwork](../artwork-generator/OVERVIEW.md) branches from F0 and its agreed design fixtures (A0). It never blocks the v0.1 runtime release. Tracker source implementation unlocks A1; completion/correction implementation unlocks A2. Only shared prerequisites merge into develop during v0.1; renderer commits remain on the artwork branch.

## Progress and release evidence

- [x] Product policies reconciled; missing historical source is provenance only.
- [x] Component tasks, ownership roles and external gates defined.
- [x] F0 foundation: frozen installation, workspace checks, production build, PostgreSQL/Mailpit startup and web/worker smoke verified; see [root evidence](../../README.md#foundation-verification).
- [x] F1 command/schema implementation, lifecycle matrix, fictional fixtures and boundary review.
- [x] F2 domain/identity/privacy services with clean PostgreSQL migrations and real transaction/race tests.
- [x] F3 browser/Discord parity, live local mail, worker retries and integration smoke tests; see [local evidence](../../README.md#local-tracker-verification).
- [ ] External service gates, pilot, restore and release.

Risks: safe account linking, cross-season slot races, same-day 101st-report edits, hidden seed leakage, expiring grant races, and artwork source sufficiency. Tests must cover these before dependent releases. Each component records actual evidence when implemented; no checked planning task implies working application code.

## Evolution

2026-10-06: approved retained history, independent accounts, attempt seeds, single unfinished-season slot and controlled artwork replacement. This supersedes the initial destructive-reset/random-enrollment-seed assumptions. No deployed database exists; implement a clean initial migration rather than inventing a production data migration.
