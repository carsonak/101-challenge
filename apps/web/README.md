# Browser and guild adapters

The browser supports independent email accounts, optional provider login/linking, seasons, custom/template setup, private daily reports, retained revisions/history, cancellation/resumption/restart and controlled correction grants. Administrator views contain metadata only. No artwork UI or runtime is included.

`/api/v1` uses bounded native requests, actor-derived authorization, exact-origin and CSRF checks for cookie mutations, optimistic versions, scoped stable cursors and command idempotency keys. Exports contain owner history without seeds/proofs. Account bearer tokens are HttpOnly cookies, never JSON fields. Local verification/recovery uses Mailpit; Google JWT and Discord stable-subject validation use server-only transports.

`POST /api/discord` verifies raw-body Ed25519 signatures and five-minute timestamp freshness before account lookup. Only guild actors linked to independent accounts can mutate. Replies are private and suppress mentions; slow commands defer immediately. Actor-bound modal/confirmation metadata expires in ten minutes. Report bodies and interaction tokens stay transient. A submitted form has one logical command identity, so duplicate delivery cannot repeat reports/restarts. Complex goal/milestone/history management links to the private browser. The exported guild command manifest is not registered automatically; live installation is the E-Discord gate.

See [operations](../../docs/operations.md), [authentication](../../docs/authentication.md) and [domain rules](../../docs/domain.md). Run the root development/start commands; these load the root `.env`. Every API query independently authorizes ownership; client routing is not an authorization boundary.
