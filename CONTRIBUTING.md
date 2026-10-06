# Contributing

These practices apply to individual and collaborative development from any repository checkout. The optional [carsonak workflow](docs/workflows/carsonak.md) describes one personal setup; adopting it is not a contributor requirement.

## Architecture and source layout

Consult [architecture decisions](docs/adr/README.md) and [domain rules](docs/domain.md) before changing shared behavior. The [modular monolith decision](docs/adr/0001-modular-monolith.md) defines these boundaries:

| Location             | Responsibility                                      |
| -------------------- | --------------------------------------------------- |
| `apps/web`           | Browser UI, API, and Discord adapter                |
| `apps/worker`        | Notifications and maintenance                       |
| `packages/contracts` | Shared schemas, commands, results, and typed errors |
| `packages/core`      | Authorization and domain services                   |
| `packages/db`        | Database schema, repositories, and migrations       |

The runnable foundation implements these package boundaries; domain features remain planned. Inspect the active checkout's manifests, configuration, component documentation, and CI for setup and verification commands. Check official documentation when selecting dependency versions or implementing external protocols.

Adapters authenticate and validate; domain services authorize and enforce lifecycle rules; repositories persist. Coordinate shared contracts and migration changes before dependent work, and review their combined effect during integration. Domain services must remain independent of web and Discord framework types.

## Branching and review

- Use `develop` as the integration baseline and feature/fix PR target. Promote validated releases from `develop` to `main`. Preserve both long-lived branches.
- Use focused topic branches, such as `feat/<topic>` or `fix/<topic>`, and Conventional Commits: `type(scope): imperative description`.
- Keep experimental work separate until its integration is approved against the applicable scope and acceptance criteria.
- Inspect status and the intended baseline before beginning work. Coordinate overlapping changes and preserve others' contributions.
- Follow existing PR templates. Describe the concrete problem, resulting behavior, useful implementation details, verification, material risks, and coverage gaps. Anchor review findings to relevant code and recommend actionable fixes.
- Avoid rewriting shared history without agreement. Prefer safe branch deletion after verifying integration and recoverability.

## Verification and parallel development

Run commands from the checkout that owns the change. Use checks defined by project configuration and CI; run relevant focused checks and required aggregate checks. Do not claim checks ran when tools or services were unavailable.

Test behavior and contracts with deterministic clocks and fictional fixtures. Relevant coverage includes reporting dates across gaps and timezone transitions, duplicate submissions, restart/completion races, rollback, stable completion records, adapter parity, and worker retries. Use real PostgreSQL for constraints, migrations, locking, and transaction tests. UI changes require appropriate accessibility and interaction verification. Documentation-only edits require content, formatting, and link checks. Investigate flaky failures rather than repeatedly rerunning for a pass.

Concurrent checkouts or stacks must have independent ports, database names, container/Compose project names, worker queues, environment files, caches, and outputs. Discover supported configuration rather than inventing variable names. Verify database and queue targets before starting services; one stack's worker must not consume another's jobs. Apply competing migrations to separate disposable/local databases, not a shared development database. Keep test data separate from participant data.

## Code documentation

Use JSDoc for code documentation throughout the project. Write for a developer using the symbol: explain what it provides, when to use it, and how to use it. A short description may answer all three; prefer useful, concise prose over a fixed template.

- Document every exported function, value, type, default export, and publicly accessible returned member. Include meaningful failure behavior, resource ownership, required cleanup, and notable side effects such as I/O, data changes, logging, or starting processes.
- Use parameter, return, and error descriptions when they clarify the contract. Avoid repeating TypeScript types or requiring examples for obvious usage.
- Give executable modules file-level JSDoc describing purpose, invocation, prerequisites, and side effects, including any work performed immediately when executed or imported.
- Give private helpers and meaningful module-level constants shorter JSDoc. Routine local variables and anonymous callbacks do not need documentation.
- Keep implementation details and notes for future contributors in ordinary inline comments, outside JSDoc. Public documentation describes observable behavior and caller responsibilities rather than internal algorithms or storage choices.
- Update documentation with behavior changes. Review it against actual commands and side effects; exclude generated declarations, build output, dependencies, and files whose format cannot contain JSDoc.
- For documentation-only edits, verify executable syntax is unchanged and run formatting, lint, and documentation-link checks. Documentation does not require new behavioral tests or tooling dependencies.

## Security and documentation

Enforce resource authorization, safe response projections, and explicit confirmation for destructive user operations. Never commit credentials, tokens, private report bodies, real participant fixtures, or machine-specific environment files. Redact sensitive content in logs and keep private session details out of public issues, reviews, and PRs.

Use [directory READMEs](plans/README.md) to discover current planning groups. Record durable architecture decisions in ADRs and lasting behavioral requirements in domain documentation. Plans may be cleaned up; documentation needed to maintain the project must survive that cleanup. Keep developer guidance here rather than duplicating it in agent instructions.
