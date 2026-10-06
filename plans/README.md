# Plans

Plans are tracked working documentation grouped by initiative under `plans/<initiative>/`. Their content and directory names may change or be retired; durable agent and contributor guidance must not depend on a particular group remaining present.

## Discover and structure plans

Read the relevant group's README for purpose, source context, specific plan usage, and reading order. Directory-local READMEs may link specific plans and groups. Discover current groups from this directory rather than assuming a fixed initiative exists.

- A single-phase group has a `README.md` entrypoint and a `plan.md` containing goal, steps, acceptance criteria, unresolved questions, progress, and evolution.
- A multiphase group also has an `OVERVIEW.md` with a bird's-eye view, phase/component links, dependencies, current progress, cross-cutting risks, and release gates. Component plans contain their own tasks and acceptance criteria.
- Group related work together; use descriptive initiative, phase, or variant names. Add subdirectory READMEs where needed for discovery. Do not create empty speculative groups.

## Use and retire plans

Separate established requirements from proposals. Update progress after meaningful verified steps; record changes, reasons, compatibility/migration effects, evidence, and remaining blockers. Planning completion is not implementation evidence. Reconcile branch-local changes during integration and keep links valid.

Before authorized cleanup, preserve durable decisions in ADRs, lasting requirements in domain documentation, and developer practices in CONTRIBUTING. Check references and active dependencies before deleting a group. Plans may be removed once their useful content has been preserved and ongoing work no longer relies on them.

Working artifacts are not plans and must remain untracked outside repositories/worktrees. See the optional [carsonak workflow](../docs/workflows/carsonak.md) for personal workspace conventions.

## Current initiatives

- [v0.1 tracker](v0.1-challenge-tracker/README.md): local foundation and tracker implementation gates.
- [Artwork generator](artwork-generator/README.md): separately branched generator, integration and public release.
