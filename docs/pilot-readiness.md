# Hosted pilot acceptance

Local acceptance prepares the tracker for deployment; it does not authorize
additional users. The owner sets up the server, reviews every web and Discord
path there, and closes the gates below before inviting users or installing on the
Bitdevs Kisumu server. UI polish and artwork follow separately toward v1.0 under
the [compatibility policy](compatibility.md).

## Local MVP evidence map

| Behavior                                       | Automated evidence                                                             | Owner/server acceptance                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Signup, verification, recovery/reset, sessions | auth-postgres, session, web-api and browser QA tests                           | Verification and recovery reach the intended inbox; old proofs and revoked sessions reject        |
| Google/Discord login and explicit linking      | providers, oauth-origin, OAuth races/linking and browser OAuth tests           | Each provider's first/repeat login, linking, cancellation, profile and identity conflict handling |
| Profiles, recovery address and deletion        | qa-postgres, restricted-login topology and browser QA                          | Username/avatar, recovery-only email versus password login, devices, deletion/recovery            |
| Season administration and enrollment/setup     | domain-postgres, qa-postgres, tracker-contracts and browser QA                 | Draft/publish/edit, recommended/custom setup, occupied slot and date restrictions                 |
| Reports, edits, backfill, milestones/perks     | domain-postgres, domain-rules, qa-postgres and browser QA                      | Required goal values, report edits, missing dates, boundary dates and error recovery              |
| Pause/resume, cancellation and restart         | domain-postgres, qa-postgres, Discord fixtures and browser QA                  | Both adapters preserve history and show accurate confirmation and recovery paths                  |
| Completion, correction grants and stable seeds | completion/expiry races, correction grants, topology and MVP upgrade tests     | Completion is immutable; owner-only history/export and authorized corrections remain private      |
| Discord daily loop and adapter parity          | signed Discord fixtures, hardening, proxy and web-api tests                    | Linked join/setup/report/edit/pause/resume plus help/dashboard and website handoff                |
| Worker and maintenance                         | jobs, topology, diagnostics and production smoke                               | Active queue, retries, housekeeping, maintenance schedule and readiness/outage handling           |
| Upgrade and recovery                           | migration-postgres, MVP migration guard/upgrade and local restore evidence     | Encrypted hosted backup, current deletion ledger, timed server restore and migration rehearsal    |
| Responsive/security behavior                   | full browser theme/viewport, accessibility, keyboard, CSP and hydration checks | Hosted HTTPS pages, redirects, proxy trust and every role's authorized/denied paths               |

Test names above describe suites, not proof that the latest run passed. See
[dated verification](verification.md) for actual results. Browser OAuth uses
fictional enabled providers and intercepts external navigation; it never proves
real provider consent.

## Confirmed private local provider checks

The owner confirmed Discord login, Google linking, and recovery-address delivery
and verification. A read-only account check confirmed one finalized profile with
both provider identities and a verified recovery address. This does not establish
Google first-login, password signup verification, cancellation, conflicting links,
provider profile behavior or hosted acceptance. Do not retain the owner's
username, address, identity subjects or account contents in synthetic artifacts.

## Server review checklist

- [ ] Configure HTTPS origin and exact provider callbacks for the deployed OAuth
      clients. Verify each enabled provider's first/repeat login, link/cancel/profile
      behavior and rejected conflicting links without merging accounts by email.
- [ ] Configure separate restricted web/worker logins, migrator and privileged
      maintenance credentials. Verify queue ownership and migration-aware readiness;
      web must lack migration, role-promotion and erasure privileges.
- [ ] Schedule private maintenance; verify mail retries, deletion deadline,
      recovery and eventual erasure on fictional accounts. Verify housekeeping and
      projection recovery after an outage.
- [ ] Authenticate the sender/domain and confirm verification/recovery messages
      arrive outside spam. Distinguish recovery-address verification from a verified
      password credential.
- [ ] Verify domain/TLS/firewall, secret storage, resource limits, sanitized log
      collection/retention and monitoring. Configure trusted forwarded addresses only
      behind an ingress that overwrites them and blocks direct application access.
- [ ] Configure encrypted hosted backups and independent deletion-ledger recovery;
      rehearse a timed isolated server restore and populated migration upgrade before
      allowing real traffic.
- [ ] Review all rows in the evidence map with fictional accounts on the server,
      both themes and mobile/desktop, including unauthorized and failure paths. Verify
      signed Discord requests, guild registration/readback, private replies and the
      linked daily loop. Use the production ingress rather than the local quick tunnel.
- [ ] Resolve failures, record the reviewed application version and evidence, and
      explicitly accept the pilot before inviting more users or installing on Bitdevs
      Kisumu. Keep owner/private data out of shared review records.

No VPS, DNS, provider-console, guild-registration or hosted-storage mutation is
implied by this document. Those operations need separately authorized targets.

## Pre-QA handoff

The [pre-QA audit and plan](../plans/pre-qa-readiness/README.md) maps every supplied
finding and additional defects to fixes or explicit hosted acceptance. Use the
[versioned QA guide and supplements](manual-qa.md), [support procedures](support.md)
and [numbered VPS runbook](../deploy/runbook.md) for the owner-led pass. Local
acceptance is recorded in [dated evidence](verification.md); it does not tick any
of the server gates above. Verify an actual monitored CONTACT_EMAIL before
invitations, install/test alert delivery and repeat the load/restore trials on the
selected VPS and off-server storage.
