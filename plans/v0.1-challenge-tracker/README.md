# v0.1 challenge tracker plans

Start with [OVERVIEW.md](OVERVIEW.md), then architecture, data model, lifecycle and API. Durable requirements live in [domain rules](../../docs/domain.md) and [ADRs](../../docs/adr/README.md).

## Scope and source status

Build the browser-first 101-reporting-day tracker with optional Google/Discord login and guild convenience commands. Preserve history and generic future-artwork inputs. Artwork runtime is a [separate initiative](../artwork-generator/README.md).

The current plans and approved product review of 2026-10-06 are the baseline. The historical `Bitcoin Challenge Planning.txt` was unavailable and is not incorporated; this provenance is not an implementation blocker. New source material requires explicit reconciliation rather than silently changing accepted policies.

## Accepted changes from the initial proposal

Retain attempts/logs instead of deleting on reset. Independent web accounts replace Discord-only identity. Use per-attempt seeds derived from initial goals instead of random enrollment seeds. One active unfinished season replaces unrestricted concurrent qualifying seasons. Same-day log edits and keyed corrections replace unrestricted history editing. Versioned artwork replacement is separate from permanent completion facts.

## Component index

| Component                                            | Responsibility                              |
| ---------------------------------------------------- | ------------------------------------------- |
| [01 Architecture](01-architecture.md)                | Boundaries and runnable foundation          |
| [02 Data model](02-data-model.md)                    | Schema, constraints and migration ownership |
| [03 Authentication](03-authentication.md)            | Email, Google, Discord and safe linking     |
| [04 Seasons/enrollment](04-seasons-enrollment.md)    | Slot, cancellation and resumption           |
| [05 Goals](05-declarations-goals.md)                 | Initial setup and retained revisions        |
| [06 Reports](06-daily-updates.md)                    | Dates, edits and correction grants          |
| [07 Milestones](07-milestones.md)                    | Reporting-day targets and revision locks    |
| [08 Streaks/perks/seeds](08-streaks-perks-seeds.md)  | Private entropy and reroll credits          |
| [09 Lifecycle](09-reset-completion.md)               | Retained restarts and atomic completion     |
| [10 Web](10-web-ui.md)                               | Participant/admin flows                     |
| [11 Discord](11-discord-interface.md)                | Guild adapter                               |
| [12 API](12-api-service.md)                          | Commands, versions and transactions         |
| [13 Operations](13-jobs-operations.md)               | Jobs, retention and recovery                |
| [14 Testing](14-testing.md)                          | Integration and release evidence            |
| [15 Privacy](15-security-privacy.md)                 | Projections, grants and erasure             |
| [16 Deployment](16-deployment.md)                    | External prerequisites and release          |
| [17 Artwork boundary](17-future-artwork-contract.md) | Shared input prerequisites only             |
