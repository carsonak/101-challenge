# Artwork execution and branch gates

Status: plan and fictional seed vectors prepared; renderer/integration not implemented.

## Gates

| Gate                      | Prerequisites and evidence                                                                                                    | Work unlocked                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A0 Foundation             | Shared runnable workspace; accepted input design; checked fictional derivation vectors                                        | Local generator/lab on feat/artwork-generator      |
| A1 Tracker sources        | Actual initial seed persistence, revisions, daily source facts, streak grants, private authorization and source-version tests | Real participant previews and reroll spending      |
| A2 Completion/corrections | Atomic completion, grant redemption, source-revision snapshots and race tests                                                 | Finalization, controlled replacements and backfill |
| A3 Public release         | Object storage, public projection/visibility tests, stale-publication protection, purge/erasure and recovery drill            | Public gallery/assets and production jobs          |

A0 does not require a Discord app, Google app, mail provider, host or live database data. A1/A2 require tracker code, not tracker deployment. A3 needs hosting/storage secrets; implement local storage adapters and fixtures first. Missing external setup must never block the lab.

## Branch and integration ownership

Start `feat/artwork-generator` at the verified shared foundation commit. Add generator/lab packages only there. Use an independent checkout with separate ports, database, Compose project, queue schema and ignored environment file. Integrate shared tracker changes from develop; propose prerequisite fixes as focused tracker changes first. Do not independently edit tracker migrations or duplicate completion logic. Branch creation does not authorize parallel agents or deployment.

Generator owner: 01–03. Integration owner: shared source contracts/migrations and 04. Delivery/operations owner: 05–06. These are roles, assigned when development begins.

## Progress and risks

- [x] Accepted lifecycle, seed recipe and release gates documented.
- [x] Fictional deterministic base-seed vectors available.
- [x] A0 foundation and fictional derivation vector verified; see [root evidence](../../README.md#foundation-verification). Local lab development may begin on the artwork branch.
- [ ] A1 actual source/credit contract and fixtures pass.
- [ ] A2 finalization/correction/backfill races pass.
- [ ] A3 privacy, replacement, restore and public release pass.

Risks: SVG metadata leaks, retry sampling new randomness/time, palette/tile changes on ordinary edits, stale render after replacement, unbounded rendering input, and source-version drift. Pin generator/serializer/fonts/config and store input digests. Initial implementation starts with fixture-driven vector geometry; live source binding remains behind A1.

## Evolution

2026-10-06: split from v0.1, replacing unconditional artwork immutability with one current edition and explicit correction/deletion grants. No rendering tables/migrations have been deployed.
