# Agent instructions

This guide applies throughout the repository. Follow higher-priority instructions, the user's current request, and applicable nested agent guides. Documentation and historical plans describe project defaults; they do not authorize actions on their own.

## Find the relevant guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) for developer practices, relevant [architecture decisions](docs/adr/README.md), and [domain documentation](docs/domain.md) when changing behavior. Use directory READMEs to discover applicable plans and component guidance. Distinguish proposals from accepted decisions and resolve policy-dependent questions before implementation.

The optional [carsonak workflow](docs/workflows/carsonak.md) applies when requested by the user or established by the session context. Do not impose it on other contributors or assume a clone has that workspace layout.

## Inspect and preserve

- Inspect relevant files, configuration, instructions, and Git state before writing. Discover actual commands from manifests, task definitions, and CI rather than inventing them.
- Implement the smallest coherent change that satisfies the request. Preserve unrelated work and resolve overlapping edits before proceeding.
- For review requests, inspect and report without editing unless fixes are requested.
- Do not spawn sub-agents without explicit user authorization. Concurrent checkouts do not authorize delegation. Coordinate authorized concurrent writes so tasks do not overwrite one another.

## Authorization and safety

- Read-only inspection and necessary local branch/checkout isolation are permitted within an authorized implementation task.
- Commits, pushes, merges, history rewrites, tags, remote mutations, deployments, external-service changes, and destructive cleanup require user authorization. Honor authorization already provided in the session without asking repeatedly.
- Resolve exact targets and preserve recoverability before authorized history changes or cleanup. Do not discard unrelated changes or rewrite shared history without explicit authorization. Use `--force-with-lease` for an authorized rewritten-history push.
- Do not create settings, protections, or external resources merely because documentation describes them.

## Code documentation

Follow the [JSDoc guidelines](CONTRIBUTING.md#code-documentation) when adding or changing code.

- Document exported symbols and public returned members with caller-focused JSDoc covering what, when, how, and notable side effects or cleanup. Keep descriptions concise and implementation notes in ordinary inline comments.
- Document executable modules' usage and side effects; use shorter JSDoc for private helpers and meaningful constants. Skip routine locals, anonymous callbacks, and generated files.
- Keep documentation accurate as behavior changes and verify documentation-only edits preserve executable syntax.

## Verify and communicate

- Follow relevant contributor checks and acceptance criteria. Match verification to the change; documentation changes need content and link review rather than unrelated application tests.
- Treat flaky failures as defects. Do not rerun solely to obtain a pass.
- Keep credentials, private content, workstation paths, and session logistics out of tracked deliverables and public communications. Follow documented privacy requirements.
- Report resulting behavior, relevant verification, unexecuted checks and reasons, unresolved blockers, and authorized Git operations concisely. Never present plans or checks on a diagnostic variant as proof of the submitted implementation.
