# ADR 0002: Retained history and replaceable artwork editions

Status: Accepted, 2026-10-06.

## Context and supersession

Initial plans deleted attempt progress on reset, used immutable enrollment seeds, and forbade all artwork replacement. Product review explicitly replaced those proposals. Users keep all attempts, can correct logs with administrative grants, and can replace seasonal artwork with a separate grant.

## Decision

Use retained attempts and revisioned goals/milestones; keep only the latest daily log text. Freeze per-attempt seed inputs at start. Keep a unique seasonal completion entitlement separate from versioned correctable source data and artwork editions. Restart creates a new attempt; cancellation pauses it. Corrections preserve dates/counts/completion and update source revisions. Authorised deletion changes the artwork generation, never the completion entitlement.

Lock user → enrollment → attempt for lifecycle and reporting mutations, followed by report/grant/credit records as needed. All adapters use this order. Serialize source changes and worker publication using source revision plus artwork generation. Record content-free audit and outbox events. Public artwork must not reveal private inputs.

## Alternatives and consequences

Destructive reset conflicts with required history. A permanently frozen rendering snapshot cannot support corrections. Unlimited replacement conflicts with rarity. Separating completion truth from rendering editions supports all three concerns, but requires explicit grants, cache invalidation and stale-job checks. See [domain rules](../domain.md) for the accepted behavior and [artwork plans](../../plans/artwork-generator/README.md) for release gates.
