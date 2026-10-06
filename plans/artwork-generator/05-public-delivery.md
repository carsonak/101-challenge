# Public artwork and optional overlays

Owner: delivery/privacy. Gate A3; develop with local storage fixtures before provisioning. Status: not implemented.

## Storage and projections

Use a storage interface with local private files for development and an S3-compatible private bucket for production. Delivery resolves an opaque public artwork ID through the current-edition manifest; bucket objects are not independently public. Use short-lived delivery links or an application proxy so revocation can stop origin access. Cache keys bind edition generation and presentation version. Purge CDN entries on correction/deletion/erasure. Previously downloaded copies cannot be recalled.

Base art has no raw text, seed, Discord/email/internal user IDs or hidden metadata. Public visibility is required for the piece, not for private source inputs. Initial goals, milestone labels, longest streak and start/end dates are separate off-by-default toggles. Enabling a toggle previews precisely the fields exposed. Use a server-built public projection and separate sanitized presentation overlay; never leak opted-out values through source JSON, SVG comments, alt text or PNG metadata. Disabling a toggle increments presentation version, withdraws old presentation and purges delivery caches without rerolling base art.

Only ready/current editions appear in the public gallery. Enforce output bounds and sanitization even for internal renderers. No participant identifiers are needed for the anonymous default artwork page. Public URLs must not encode seeds or private input hashes.

## Tasks and tests

- [ ] Storage adapter, current-edition resolver, public gallery and owner visibility settings.
- [ ] Sanitized SVG/PNG exports, safe text overlay escaping and bounded dimensions.
- [ ] Deletion/visibility/erasure purge jobs and retryable cleanup ledger.
- [ ] Test every opt-in toggle, anonymous access, direct old object access, malicious SVG/text and stale caches.

Do not promise that recipients cannot save public images. Document origin revocation versus copies outside project control. Brand assets remain governed separately from Apache-licensed code; users' private text/output ownership is not silently licensed by the repository license.
