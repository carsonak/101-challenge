# Shared contracts

The v0.1 command registry validates enrollment, setup, lifecycle, goals, milestones, reports, corrections and season administration. Strict schemas reject authoritative client fields; core still owns authorization, date resolution and transactional lifecycle/version rules. Result references and events contain safe identifiers, while owner/admin projections have separate allowlists.

`@challenge/contracts/fixtures` provides deterministic fictional adapter inputs. `@challenge/contracts/source` is a private server-only source schema for future backfill and must never enter transport responses. Authentication contracts remain separate from tracker commands. Server configuration must never be sent to clients.

See [lifecycle state matrix](../../docs/lifecycle.md) and [domain rules](../../docs/domain.md) for semantics. F1 schemas do not imply working services or adapters.
