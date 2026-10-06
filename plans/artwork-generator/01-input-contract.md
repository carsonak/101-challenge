# Private input contract and derivation

Owner: integration. Gate: design/fixtures at A0; production provider at A1. Status: specification, not a public API.

## Version 1 boundary

Tracker exports a server-only authorized `AttemptSourceV1`: schemaVersion, user/enrollment/season/attempt IDs, attemptMode/status, timezone, startedAt, baseSeed/seedVersion, sourceVersion, initial goals/milestones, current report inputs, optional completion entitlement. `CompletionSourceV1` binds entitlementId, completedAttemptId, completedAt and the same attempt source at a consistent sourceVersion. Read in a transaction, reauthorize on every request, never expose either DTO to a browser/admin endpoint.

Each report source has reportId, reportingDate, reportingIndex (1..101), latest log text and structured goal values, updatedAt (the persisted freeze time), streak-at-report, selected perk facts and locked applicable milestone revision facts. Later goal/milestone changes never alter prior report facts. A correction replaces latest text/values/timestamp and increments sourceVersion; counts, date, base seed and original milestone facts remain. Art owns selection/reroll counters and replacement generation. Private render input combines both sources at explicit revisions.

## Canonical seed recipe

Use seedVersion `attempt-v1`. Generate 32-byte private random participant and season seeds; store bytes, use lowercase hex only for private transport/fixtures. Derive:

1. Canonical initial JSON: `{version:1, participantSeed:<hex>, startedAt:<UTC ISO milliseconds>, goals:[...], milestones:[...]}`. Include goal title/description/metricKind/unit/target and milestone title/description/targetReportingDay/goalIndex; omit database IDs. Preserve explicit setup order. Optional arrays are `[]`; absent optional scalar fields are null.
2. Normalize strings to Unicode NFC and LF line endings; trim only fields whose input validation trims (titles and report edges). No locale-dependent case conversion. Decimal values are canonical decimal strings, no exponent/trailing fractional zeroes. Keys sort lexicographically recursively; arrays retain order; UTF-8 JSON has no insignificant whitespace. Only safe integers are JSON numbers.
3. `baseSeed = HMAC-SHA256(seasonSeedBytes, UTF8("attempt-v1\n" + canonicalJSON))`. This includes participant entropy and season entropy without making goal text guessable from public outputs. `initialInputDigest = SHA256(canonicalJSON)` remains private.
4. Domain-separated HMAC streams derived from baseSeed control geometry, palette, date selection and per-tile detail. Never use Math.random, locale formatting, wall clock at render time or private database IDs as visual input.

The [fixture vectors](fixtures/README.md) fix these bytes and expected hashes. Goal edits retain base seed; starting a new attempt changes startedAt and hence seed. The source algorithm is open-source; private seed values are not public.

## Daily selection and detail

At local midnight, derive candidate tile/colour from baseSeed + local date + explicit reroll counter, using the remaining unoccupied tile IDs and seasonal palette. Persist selection and its input version on first materialization. Since all earlier local dates are closed, that date's remaining tile set is stable. Missing dates reserve no tile. Setup on day one materializes immediately. A delayed worker computes the same logical midnight choice; no cron availability requirement.

Detail digest binds baseSeed, normalized latest log text, structured goal values, reporting index/date, saved updatedAt, streak, selected perks, milestone facts, selection identity and artwork variation. Ordinary saves change detail, not selection. Explicit reroll increments its counter and atomically spends a credit; choose a different tile when more than one remains and a different colour (palette must contain >=2). Day 101 changes colour when only one tile remains. Rebuild corrections using persisted original selection; do not silently select a new tile for a past date.

## Tasks and acceptance

- [ ] Implement private source schemas and canonical serializer with checked vectors before live provider work.
- [ ] Add fixtures for initial/restarted/cancelled/100/101/progress-only/corrected sources and source-version mismatch.
- [ ] Version schema changes; consumers reject unsupported versions rather than guessing defaults.
- [ ] Verify same inputs produce identical seed/digest across process restart and timezones.
- [ ] Verify private fields never appear in transport projections, logs, SVG comments or export metadata.

Record implementation evidence here; tracker source work belongs in tracker-owned packages, never a duplicate art database schema.
