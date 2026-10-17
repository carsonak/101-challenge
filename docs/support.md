# Participant support

Use the monitored CONTACT_EMAIL shown in [Help](../apps/web/app/help/page.tsx).
Ask for username, affected page, approximate time and request ID; never request a
password, token, correction key, private report text or provider secret. Look up
handles in the participant-first correction screen. Application administrators
see metadata only. Privileged SQL is a separate operator capability, not an admin
API. Keep incident evidence private and content-free.

## Verify ownership before changing access

A public username or an email claim is not proof. Prefer a current authenticated
session plus recent sign-in, or the existing email/provider recovery flow. For
lost access to every method, require independently documented proof and a second
operator review; if identity remains uncertain, decline the access change. Do not
silently merge accounts or reassign provider subjects. Record who approved an
exception, the content-free account ID, reason category, exact operation and time.

## Verification email missing

1. Ask the participant to use `/verify`, check spam and wait fifteen minutes
   between requests. Responses are deliberately identical for unknown, verified
   and cooling-down addresses. A transient mail failure still consumes cooldown.
2. Inspect mail_failed and mail_accepted around the request ID/time; provider
   acceptance is not delivery. Check sender/domain authentication and provider
   suppression privately. Never paste mail payloads or bearer URLs into a ticket.
3. Restore mail delivery and have the participant request a fresh link. Prefer
   this to operator verification. A manual fallback is permitted only after
   independently proving control of the credential address, documented approval
   and target readback.

Run the following only through a private operator psql session. Set account_id
from a confirmed exact lookup; psql variables use `:'account_id'::uuid`, never shell
interpolation. BEGIN and inspect each SELECT/UPDATE result before COMMIT; ROLLBACK
on any mismatch. Execute separate blocks independently.

```sql
BEGIN;
SELECT u.id, p.username, c.email, c.verified
FROM users u JOIN profiles p ON p.id=u.id JOIN credentials c ON c.id=u.id
WHERE u.id=:'account_id'::uuid FOR UPDATE OF u, c;
-- Only after address ownership and exact target are verified:
UPDATE credentials SET verified=true WHERE id=:'account_id'::uuid;
UPDATE auth_tokens SET "usedAt"=now()
WHERE "userId"=:'account_id'::uuid AND kind='verify' AND "usedAt" IS NULL;
COMMIT;
```

This fallback does not set or replace a recovery email. The participant must
verify that separately in Account settings. Test on a fictional account first.
Do not automate a bypass for failed delivery or accept a username alone.

## Administrator promotion or demotion

Confirm the intended person and exact UUID using the private lookup above. The
runtime cannot update users.admin. Use the operator connection and inspect one row:

```sql
BEGIN;
SELECT u.id, p.username, u.admin FROM users u JOIN profiles p ON p.id=u.id
WHERE u.id=:'account_id'::uuid FOR UPDATE OF u;
UPDATE users SET admin=true, "updatedAt"=now() WHERE id=:'account_id'::uuid
RETURNING id, admin;
UPDATE sessions SET "revokedAt"=now() WHERE "userId"=:'account_id'::uuid;
COMMIT;
```

For demotion use admin=false with the same target/readback/session revocation.
Confirm a fresh sign-in has the expected navigation and API permissions. Keep a
verified operator recovery route; do not demote the only operator accidentally.

## Compromised account or temporary access suspension

Suspension is reversible and preserves reports, completion, seeds, identity
ownership and occupied slots. It does not schedule deletion or stop an already
scheduled erasure. Only the operator can write account_suspensions; the runtime
has SELECT permission only.

```sql
BEGIN;
SELECT id FROM users WHERE id=:'account_id'::uuid FOR UPDATE;
INSERT INTO account_suspensions(id, "suspendedAt") VALUES(:'account_id'::uuid,now())
ON CONFLICT(id) DO NOTHING;
UPDATE sessions SET "revokedAt"=now() WHERE "userId"=:'account_id'::uuid;
UPDATE auth_tokens SET "usedAt"=now() WHERE "userId"=:'account_id'::uuid;
UPDATE oauth_states SET "usedAt"=now() WHERE "userId"=:'account_id'::uuid;
COMMIT;
```

New and existing sessions, password/provider sign-in, tracker actions and linked
Discord access reject. After ownership and compromised methods are resolved under
separate approval, lock the user and DELETE the single account_suspensions row in
a transaction. Sessions revoked during suspension stay revoked; require fresh
sign-in. Never use account deletion as a temporary lock. Retained backups can
contain the earlier access state; reconcile current suspensions during restore
acceptance as well as replaying erasures. Restrict traffic until this review passes.

## Lost email, changed email or wrong linked provider

- Still signed in with another usable method: use Account settings to link/test
  a replacement first, then unlink the incorrect method. All sessions are revoked
  on unlink. Change recovery email directly in settings; the old alias stays
  until the new address is verified. Password sign-in does not require email.
- Password change: use Account settings with recent proof or `/recover`. Changing
  or resetting a password invalidates sessions and outstanding credential proofs.
  Old verification/reset links cannot authorize a replacement credential.
- If password sign-in remains, use username/password to change a lost recovery
  email in settings. If all credentials and providers are lost, there is no
  ownership-safe automatic replacement. Never overwrite email by matching a
  requester's claim. If ownership cannot be established, refuse transfer.
- Provider-only and no recovery address: the provider's own recovery is the first
  route. A verified recovery address can receive a password-reset link even before
  a first password is set. Keep
  an additional usable method linked before access is lost.

## Two accounts and missing progress

Ask which method originally held history; sign out and use it. An unlinked Google
or Discord sign-in creates a separate account even if an address looks the same.
Do not merge enrollment rows, seeds or completion entitlements. To connect a
provider already attached to an unwanted account, the participant must prove both
accounts, retain a usable method on the unwanted one, unlink the provider there,
then sign in to the intended account and link it. If they cannot retain a method
or prove both accounts, escalate; there is no supported merge operation. Offer
owner exports and explain that history is not transferable.

## Report corrections and accidental erasure

Select the participant by username, then the retained attempt/report. Confirm the
recipient and scope before issuing a short-lived key; share privately. The owner
applies it, so admins never read report text. Revoke a mistaken key immediately.
An expired/used/revoked key cannot be reused; completion remains fixed. Backdating
requires a published season with goals, a registration date from publication
through today and no existing enrollment. Missing legacy publication timestamps
must be reconciled from verified records, never guessed.

Cancellation keeping data permits retry with history retained. Cancellation with
erasure irreversibly removes that attempt's private inputs; do not resurrect it
from backup. Account deletion can be cancelled only before its original seven-day
deadline through fresh sign-in. After erasure, the latest deletion ledger must be
replayed on restoration. Never use a backup to bypass the erasure decision.

## Pilot triage and drills

S1: privacy/access violation, lost history, broken signup/report/completion,
unrecoverable backup or required provider outage; stop invitations and contain.
S2: confusing or blocked secondary workflows; fix before expanding the cohort.
S3: polish with a recorded owner decision. Use [the QA log](manual-qa.md).

Before invitations, a second person should rehearse verification failure,
promotion/demotion, suspension/re-enable and correction issuance/revocation on
fictional accounts. Record safe target IDs, reviewed commit and outcome. The
operator should also explain the email throttle: repeated attempts for the same
address can temporarily block that address on any network; do not weaken shared
limits or disclose account existence as a support shortcut.

## Correction scope

There is no participant correction-request or support-ticket interface. Admins
may issue correction keys through the existing administration controls; owners
redeem a supplied key themselves. Do not direct participants to a request queue
or promise staffed ticket handling. Contact/privacy details do not imply a
correction service or an account-ownership bypass.
