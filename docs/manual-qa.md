# Pre-invitation manual QA

Use the supplied **101 Challenge Manual QA Guide** (13 October 2026) as the detailed
scenario inventory. Its checkboxes are test proposals, not evidence or authorization
to change production. Run it on an isolated staging stack first and repeat hosted
provider/ingress/operations scenarios on the final domain. Use fictional accounts,
a separate SMTP catcher for automated tests and independent real inboxes only for
owner-operated delivery checks. Never mix participant data with test fixtures.

## Current behavior supplements

These adjustments keep the supplied guide aligned with the current application.

| Original IDs        | Updated expected behavior / additional check                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-NAV-08, G7, G11   | Footer links Help and contact; monitored CONTACT_EMAIL is visible there and in legal pages. Missing address remains a launch blocker.                                                                                                                           |
| W-SIGN-06           | `/verify` has an explicit resend form, also linked from login. Unknown/verified/unverified addresses have identical success copy; signup and resend share a fifteen-minute cooldown. No duplicate account or password work on resend.                           |
| W-AUTH-09           | Use different addresses on different networks to isolate the address throttle. PostgreSQL shares email/action limits across replicas. Spoofed client headers must not bypass Caddy.                                                                             |
| W-OAUTH-08          | Login/signup explain linking before provider choice. Discord already gives new-account versus existing-account instructions. Independent identities remain intentional.                                                                                         |
| W-ACC-12            | Password change exists in Account settings, asks for current proof and signs out every device. Old password, sessions and reset links reject afterwards. Email replacement uses linked-method/unlink/add/verify; recovery email changes separately.             |
| W-SET-08, X-TIME    | Setup names the actual configured or frozen IANA zone and midnight boundary. Test a server setting other than Nairobi locally as well as travel/device zones.                                                                                                   |
| W-STR-02, W-HOME-01 | Credits are explicitly banked for a later artwork release; spending is unavailable. Do not expect artwork or redeemable rewards in the pilot.                                                                                                                   |
| W-COM-05            | Home has a Completed seasons acknowledgement with a challenge link. Completion remains visible during progress-only retries and another active season.                                                                                                          |
| A-BKD-02            | Invalid registration date, existing enrollment, absent template and unavailable publication timestamp have actionable distinct errors.                                                                                                                          |
| A-COR-07            | Search by username prefix; choose participant, then attempt/report. Only that participant's metadata page loads. Confirm their name before issuance; switching recipient/scope clears confirmation. Keys identify the intended recipient and remain shown once. |
| A-SAF-03            | Rehearse operator-only reversible suspension, existing-session/new-login/Discord denial and re-enable using the support runbook. Runtime must not write suspension flags.                                                                                       |
| O-OPS-05            | Maintenance now sleeps until deadlines with coarse recovery scans; do not require a fixed every-minute resident query. Verify nextRunAt and actual erasure/retry bounds. The separate ledger timer runs every minute.                                           |
| O-OPS-07–09         | Snapshot marker updates only after dump/encryption/remote publication/current ledger success. Ledger-only refresh must not hide an old backup. Test configured alert delivery and a full VPS outage.                                                            |

## Additional adversarial checks

- Get two unused verification links for one credential. Verify one, link/test a
  provider, unlink email, add another email. Neither old verification nor old reset
  links may verify/reset the replacement credential.
- Open a reset link, then change/reset the password through another session. The
  stale reset link rejects; sessions revoked before the operation stay revoked.
- Start an admin participant lookup, change the selection before its response
  arrives, and confirm stale results cannot select another person's report. Search
  with `_` and `-`, page through results and verify empty/failure states.
- Issue a key to a nonexistent report or erased attempt through the API: safe
  rejection, no 503 and no grant. Test recipient confirmation with keyboard only.
- Suspend a fictional account while its web page and Discord modal are open.
  Subsequent reads/writes reject; history/completion are unchanged. After removing
  suspension, require fresh sign-in if the operator revoked sessions.
- Exercise production non-root images with a read-only root filesystem. Confirm
  static assets, health/readiness, mail and restricted runtime permissions.
- Burst signup/login/report on actual VPS-sized staging, recording HTTP outcomes,
  latency, memory/CPU and connection counts. Check avatars separately. Use the
  [deployment runbook](../deploy/runbook.md), not participant accounts.

## Execution and evidence

Prepare ADMIN, two email users, provider-only users, a linked Discord user and
four seasons (template, empty, draft and second active-slot candidate). Have a
second person exercise admin/participant boundaries. Plan two or three reporting
days for rollover, pause release and streak checks; backfill cannot substitute
for every real-time boundary. Cover phone/desktop, light/dark, keyboard, screen
reader, reduced motion and slow/offline retries. Real Safari, Firefox, Android/iOS
Discord and low-end phone acceptance remain manual; Chromium fixtures do not
establish those outcomes.

| Test ID | P/F/B/N | Severity | Steps                               | Expected / actual | Safe request ID / artifact | Reviewer / date | Resolution                  |
| ------- | ------- | -------- | ----------------------------------- | ----------------- | -------------------------- | --------------- | --------------------------- |
| pending | B       | —        | Final-domain pass not yet performed | —                 | —                          | —               | Required before invitations |

Record the reviewed commit, environment category, browser/device, reporting zone,
synthetic account aliases and start/end times. Keep raw screenshots, private
identifiers and delivery/host details outside Git. Never put credentials or report
text in public PR discussion.

Exit only with no open S1, all required signup/auth/report/Discord/operations paths
passing on the final domain, admin flows reviewed by a second person, support and
restore drills complete and legal/contact acceptance recorded. Re-test affected
paths after every fix. The owner explicitly accepts any deferred S2/S3 item and
pilot boundaries before invitations; successful local tests do not close these gates.
