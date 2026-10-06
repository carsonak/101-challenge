# Artwork generator initiative

A separate release and feature branch, parallel to the tracker. Start with [OVERVIEW.md](OVERVIEW.md). Accepted behavior is in [domain rules](../../docs/domain.md); [ADR 0002](../../docs/adr/0002-history-seeds-and-artwork.md) explains completion versus artwork editions.

## Deliverables

| Plan                                        | Responsibility                                          |
| ------------------------------------------- | ------------------------------------------------------- |
| [01 Input contract](01-input-contract.md)   | Private source data, seeds and compatibility            |
| [02 Generator](02-generator.md)             | Deterministic 101-tile SVG/PNG generation               |
| [03 Local lab](03-local-lab.md)             | Fictional fixtures, gallery and controls                |
| [04 Integration](04-integration.md)         | Previews, credits, completion, corrections and backfill |
| [05 Public delivery](05-public-delivery.md) | Assets, visibility and replacement                      |
| [06 Operations](06-operations.md)           | Queues, reproducibility and release evidence            |

No artwork implementation is shipped with v0.1. The initial repository includes these plans and fictional [input vectors](fixtures/README.md), not a renderer. Artwork UI consumes rendered results; private inputs and seed derivation run on the server. Developer source/lab can inspect fictional seeds, never participant-facing APIs.
