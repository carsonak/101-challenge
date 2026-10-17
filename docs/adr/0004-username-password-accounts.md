# 0004: Username/password with optional recovery email

Status: accepted, 2026-10-17, per owner review.

## Context and decision

Requiring email verification before any password login prevents participation
without an inbox. Password ownership now belongs to the account, independently
of optional recovery email. A required, unique 3–40 character URL-safe username
is the default password-login identifier. A verified recovery address is an alias
for the same password and can receive password-reset links. Settings recommend
recovery email and another sign-in method on every visit.

Google signup uses a signed verified email claim as the initial recovery address
and requires choosing a username. Discord supplies a sanitized available username;
invalid or colliding defaults require selection. Neither creates a password.
A recent authenticated provider owner may add one without email. Provider subject
ownership remains independent; matching email never merges identities. An email
collision skips Google's recovery default and requires independent verification
of another address in settings.

## Consequences and compatibility

Append-only migration 0010 permits null credential email and expands the username
constraint. Existing hashes, provider identities and participant data survive.
Legacy email login/add-email commands remain supported. Sensitive changes use
current password or recent provider proof. Password changes invalidate sessions
and all outstanding email/reset proofs. Recovery address replacement preserves
the old alias until verification, then invalidates old proofs.

Email operations serialize normalized addresses and check both legacy credentials
and recovery addresses. Existing ambiguous recovery addresses remain stored but
fail closed for email login/recovery; changing to an independently verified unique
address resolves the ambiguity. Address claims never authorize account transfer.
There is no staffed correction-request or ticket interface; existing admin-issued
correction keys and owner redemption remain unchanged.

The rejected email-required alternative makes email a participation prerequisite;
using provider email matching for account linking would permit identity confusion.
