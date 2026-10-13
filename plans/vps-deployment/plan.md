# Hosted deployment plan

Status: planning complete; host configuration and deployment not started.

## Goal and scope

Host the existing web application, worker and maintenance service on the owner's Contabo VPS, with HTTPS, restricted database identities, monitored recovery and narrowly scoped agent assistance. Validate the hosted pilot before inviting participants. Preserve existing authentication, completion/seed invariants, erasure deadlines and privacy boundaries.

This plan prepares reviewable tasks. Server/account mutations, deployment, commits, pushes and destructive recovery require owner authorization under [AGENTS.md](../../AGENTS.md). Access credentials alone do not authorize an action. No server connection or cloud mutation was performed while preparing the plan.

## Decisions and open inputs

- Proposed initial database: VPS PostgreSQL using the existing production Compose draft. Paid Neon remains an option if reducing database administration justifies its measured cost and compatibility checks. Neon Free is suitable for an isolated evaluation, not the proposed continuously running pilot; see [the assessment](neon-assessment.md).
- Proposed ingress: Caddy with only HTTP/HTTPS public and all application/database ports private.
- Proposed agent access: individually revocable SSH identities and a restricted operations interface, starting with sanitized diagnostics; see [the access design](agent-access.md).
- Established recovery targets: RPO at most 24 hours and RTO at most 4 hours, demonstrated by a timed restore. Historical dumps alone cannot recover the current deletion ledger.
- Owner inputs needed: OS/version, RAM/vCPU/disk, hosting region, domain/DNS control, acceptable database budget, backup destination, administrative source network, alert destination and which recurring agent actions may be preauthorized.
- Infrastructure names, connection details, host fingerprints and account links belong in a private inventory. Tracked documentation must use placeholders.

## Responsibilities

| Work             | Owner/human responsibility                                            | Agent-assistable work                                                                  |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Host access      | Verify console recovery, install/revoke keys and approve privileges   | Prepare configuration and inspect effective settings                                   |
| Domain/providers | Control DNS, consent/billing, sender verification and legal review    | Prepare exact settings and test authorized flows                                       |
| Database         | Choose provider/budget and approve production provisioning            | Prepare scripts, run disposable compatibility tests and inspect grants                 |
| Release          | Approve version, maintenance window and deployment target             | Build/test artifacts, prepare migration/release procedure and execute authorized steps |
| Recovery         | Hold off-server keys, approve participant recovery and accept RPO/RTO | Automate backups, test synthetic isolated restores and collect safe evidence           |
| Operations       | Define standing authority and respond to alerts                       | Inspect diagnostics and execute explicitly permitted runbook actions                   |

## Work checklist

### Host and administrative access

- [ ] Inventory OS, resources, disk layout, current listeners and installed services without exposing secrets; verify provider console/rescue access.
- [ ] Create a named human administrator with sudo and key authentication. Verify a second SSH session and sudo before changing root access.
- [ ] Configure key-only SSH and disable root SSH after verification. Validate configuration and effective settings, including included/cloud-image overrides, before reload; keep a recovery session open.
- [ ] Apply OS updates, configure automatic security updates, time synchronization and a reboot maintenance procedure.
- [ ] Apply default-deny inbound rules using provider and host controls. Permit SSH from the approved administrative network and public TCP 80/443. Test both IPv4 and IPv6 without blocking console recovery or required network control traffic.
- [ ] Install Docker Engine and Compose from supported distribution instructions; enable boot startup. Inspect published ports externally because Docker publishing can bypass UFW.
- [ ] Establish private, permission-restricted directories for reviewed releases, secrets and operator state. Give agent uploads their own unprivileged staging directory.
- [ ] Implement and validate restricted agent access using [the supporting design](agent-access.md); record what each identity can do and how to revoke it.

Acceptance: human key/sudo access and console recovery work; root/password SSH restrictions are verified; only intended public listeners are reachable on both address families; agent credentials cannot bypass their permitted interface.

### Database decision and provisioning

- [ ] Record the selected topology, budget, database version and region. If evaluating Neon, use a synthetic isolated database and complete [the Neon gates](neon-assessment.md) before choosing it.
- [ ] Review production Compose instead of executing it unchanged. For VPS PostgreSQL, retain the private persistent volume and no published database port. For Neon, remove local-PostgreSQL dependencies and provide controlled database egress to every client, including the worker.
- [ ] Prepare a private operator path to the database without a public PostgreSQL listener. Keep operator/migrator connections separate from runtime service files.
- [ ] Provision separate web, worker, maintenance and migrator logins with strong unique credentials: roles first, migrations second, runtime grants third.
- [ ] Verify actual login privileges, queue-schema ownership, erasure-role inheritance, locks and migration-aware readiness. Do not replace restricted-login checks with SET ROLE from an owner session.
- [ ] Document pool/connection limits, database upgrades, connectivity failures and the private backup identity's necessary privileges.

Acceptance: the selected provider passes the existing database topology and transaction requirements; runtime services have no administrator connection; queues initialize before traffic; budget/limits and recovery procedures are understood.

### Domain, providers and reproducible release

- [ ] Set DNS A to the private inventory's VPS address. Publish AAAA only after end-to-end IPv6 verification.
- [ ] Configure APP_DOMAIN and exact HTTPS APP_ORIGIN. Verify Caddy certificate issuance/renewal, HTTP redirects and secure cookies through production ingress.
- [ ] Configure separate private `web.env`, `worker.env` and `maintenance.env` using the [configuration guide](../../docs/configuration.md); scope secrets by service. Keep operator credentials and Discord registration tokens out of runtime images/files.
- [ ] Configure production Google/Discord callbacks and interactions. Register/read back Discord commands only for the approved guild target.
- [ ] Verify authenticated SMTP delivery, SPF/DKIM/DMARC and verification/recovery messages outside spam. Do not run an SMTP server on the VPS as part of this plan.
- [ ] Review terms/privacy, processing locations and CONTACT_EMAIL with the owner before participant release.
- [ ] Build the existing image targets from a reviewed revision, run required checks and pin tested application/infrastructure image digests in the release manifest. Prefer builds outside the VPS if resource pressure warrants it.
- [ ] Validate rendered Compose without printing private values. Measure resource limits, temporary/cache write paths and outbound requirements; confirm maintenance runs every minute and shutdown avoids overlapping sweeps.
- [ ] Verify Caddy overwrites X-Forwarded-For and direct web access is blocked before enabling TRUSTED_PROXY_HEADER=x-forwarded-for and TRUSTED_PROXY_HOPS=1.
- [ ] Prepare a release procedure: pre-migration backup, migrate with private credentials, start services, verify readiness/providers, then admit traffic. Record schema compatibility and application rollback limits; prefer forward corrective migrations over blindly restoring a database.
- [ ] Reboot the host and verify automatic service recovery, persistence, TLS and readiness.

Acceptance: a pinned release serves HTTPS with correct provider callbacks, no public database/worker access and measured host capacity. The owner verifies real hosted provider flows with fictional test accounts.

### Backup automation and disaster recovery

- [ ] Choose off-server S3-compatible storage, preferably in a separate failure/account domain. Configure narrowly scoped upload credentials, restricted restore access and version/lifecycle settings.
- [ ] Use existing [backup tooling](../../scripts/backup.mjs) for encrypted custom-format pg_dump snapshots at least daily and before migrations. Supply matching PostgreSQL client tools, age and the storage CLI in a private operator environment.
- [ ] Automate scheduling with systemd timers or a dedicated private job runner. Prevent overlapping jobs, verify successful remote uploads, clean local outputs safely and alert on failure or missing recent backups.
- [ ] Wire a deletion-ledger export after every successful maintenance sweep, including sweeps that erase accounts before another operation fails. Retry failed exports and alert; verify ordering and freshness independently of daily snapshots. This integration does not currently exist in Compose.
- [ ] Define handling for a ledger upload outage: escalate immediately, identify the last current durable ledger and prevent historical recovery from being accepted until later deletions are safely reconciled. A daily ledger alone is insufficient.
- [ ] Keep age decryption identities off the VPS and test an independently stored recovery copy. Securely back up runtime secrets/configuration and release inventory separately; do not commit them or expose plaintext to agents.
- [ ] Enforce at most thirty days of operational-log/historical-backup retention, including local files and old object versions. Design current-ledger retention independently so expiration never removes the only authoritative replay source. Review the policy if a managed provider cannot meet it.
- [ ] Rehearse restoration onto a separate host/database using synthetic data. Existing restore tooling requires an empty `_restore_test` database, applies migrations and replays the latest independent ledger. Queue tables are excluded: reapply grants, initialize the worker queue and verify republished projections before acceptance.
- [ ] Write a separately reviewed participant recovery procedure. Stop traffic/workers before replay; verify erasures, completion entitlements/seeds, synthetic reporting/sign-in and readiness before admitting traffic. Never point rehearsal tools at production.
- [ ] Time full replacement-host recovery, including configuration/secrets, images and TLS, against RPO <=24h/RTO <=4h. Record safe counts and version/evidence only.
- [ ] Evaluate optional Contabo whole-server backups as an additional recovery layer. Apply current-ledger reconciliation to any whole-server restore; provider snapshots do not replace application-aware recovery.

Acceptance: backup and independent-ledger freshness are monitored; the loss of the VPS does not lose archives or recovery keys; a timed off-server restore meets targets without resurrecting erased accounts. Selecting Neon does not automatically close these gates.

### Monitoring and hosted acceptance

- [ ] Configure external HTTPS/readiness checks, host disk/memory alerts and notification routing. Monitor worker readiness/queue outages, oldest pending events, unsent account notices and erasure requests more than five minutes overdue.
- [ ] Verify logs redact proof-bearing URLs and private content, including proxy/runtime logs. Provide agents bounded sanitized diagnostics instead of raw participant records or secret-bearing container inspection.
- [ ] Prepare operator runbooks for restart, failed deployment, database outage, SMTP failure, backup failure, credential revocation and restore. Define exact standing permissions; technical access does not override repository authorization.
- [ ] Complete every [hosted pilot gate](../../docs/pilot-readiness.md) on the deployed version, including mobile/desktop, themes, denied access and real provider paths.
- [ ] Obtain explicit owner pilot acceptance before inviting users or installing on the wider community server. Preserve durable decisions/runbooks before retiring this group.

## Progress and evolution

2026-10-13: owner requested a tracked plan after VPS setup advice. Reviewed current production topology, backup/restore scripts, private local Neon recipe and current official provider material. No configuration, backup schedule, agent account or deployment has been implemented. Existing local tests are not evidence of server acceptance.

Next task: owner supplies host/domain/budget inputs; prepare the human administrator and restricted diagnostics access, then confirm the database decision before production provisioning. Independent documentation/automation preparation can proceed without cloud changes when authorized.
