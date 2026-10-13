# Agent operations access proposal

Status: proposed design; no account, key, sudo rule or operations helper exists yet.

## Access model

Use a separate unprivileged Unix identity for agent operations, with one SSH key per operator/agent integration and clear key labels. Separate Unix identities are preferable when different agents need different privileges. Never distribute a shared private key to multiple services. Keys remain in the initiating environment's protected credential store; only public keys go on the VPS.

Start with a forced-command interface exposing a small, structured set of sanitized diagnostics. An illustrative account name is `tracker-agent`; final account names and connection details belong in a private inventory. A general shell can be considered for a separately approved staging environment, where all data is synthetic.

The initiating agent needs an SSH-capable execution environment, approved network reachability, an installed credential, verified host-key fingerprints and the relevant runbooks. Creating a VPS user alone does not enable every assistant to connect. Pin host keys and fail closed on a mismatch. A VPN/bastion is optional if administrative source addresses cannot be restricted reliably; choose it after confirming client support and recovery access.

## Proposed permission tiers

| Tier                                 | Permitted behavior                                                                                      | Technical boundary                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Observe, initial default             | Health/status, reviewed release ID, resource summaries, bounded sanitized logs, backup/ledger freshness | Forced-command dispatcher with fixed read-only actions and filtered outputs                                  |
| Operate, optional standing authority | Restart named application services or trigger the fixed encrypted backup job                            | Owner-defined action policy, narrow root-owned helper and exact sudo command rules                           |
| Release, task-specific approval      | Activate a reviewed immutable release, run a specified migration and validate                           | Approved revision/digests, operator-controlled release metadata and dedicated deployment/migration mechanism |
| Recover/administer, human-led        | Restore participant data, alter accounts/firewall, rotate operator credentials, change providers        | Human operator with an approved runbook; no ambient agent permission                                         |

Standing authority must name actions, services, environment, preconditions and escalation boundaries. A server-side policy and private operator record should agree with repository instructions. When no applicable standing authorization exists, an agent prepares the result for review before requesting execution approval.

## Implementation checklist

- [ ] Create the account with no password login, no general sudo, no Docker socket/group access and no access to runtime/operator secrets, database volumes or backups containing private data.
- [ ] Install each authorized public key with a forced dispatcher and restrictions disabling PTY, forwarding and user startup hooks. Apply restrictive SSH account configuration and verify effective settings. Keep the human administration path separate.
- [ ] Build a root-owned dispatcher/helper using fixed action names, strict argument validation, a clean environment, absolute paths and no shell evaluation. Reject arbitrary commands, paths, service names and options. Bound execution time, output size and concurrency.
- [ ] Give the agent only access to a staging directory for proposed artifacts. Keep Compose manifests, release inventories, wrappers, systemd units, secrets and activated releases operator-owned. Reject symlink/path traversal and never execute uploaded scripts with elevated privileges.
- [ ] Implement approved status/resource/health queries. Do not expose `docker inspect`, rendered secret-bearing Compose output, process environments, database queries, exec shells or unrestricted journal/container logs.
- [ ] Provide application-specific diagnostics that return operational metadata only. Check that sanitization removes credentials, proof URLs and participant text; redaction must not depend solely on recognizing secret patterns.
- [ ] If approving restarts, allow only fixed services through the helper. If approving backup triggers, execute a fixed operator-owned job that exposes success/freshness metadata and no decrypted archive or credentials.
- [ ] Use a separate, explicitly approved release mechanism. Verify approved revision/digests before activation; never allow arbitrary Docker/Compose arguments, mounts, images or agent-writable configuration to enter a privileged command.
- [ ] Record access/action outcomes by key/identity, timestamp, release and safe result; avoid command bodies, secrets and participant data. Retain operational audit logs at most thirty days under the current policy.
- [ ] Test allowed commands and rejection of arbitrary shells, forwarding, Docker access, secret reads, command injection and unapproved releases. Exercise key revocation and confirm new sessions fail; terminate existing sessions where necessary.
- [ ] Add durable runbook and agent instructions describing scope, authorization, target verification, secrets handling, incident escalation and recovery. Documentation must supplement operating-system enforcement.

## Why Docker and sudo require care

Docker daemon access normally grants host-level administrative power. Adding an agent to the Docker group would undo the restricted account design. Similarly, broad sudo access to `docker`, `systemctl`, editors, interpreters or arbitrary scripts can bypass a command allowlist. Use a small reviewed helper rather than attempting to constrain arbitrary privileged CLI arguments.

A runtime deployment necessarily changes code that can access that runtime's secrets and data. Treat release activation as a privileged action even when the images run as non-root. Keep observation and release permissions separate and require review of the exact artifact being activated.

## Neon access if selected

Keep database SQL credentials distinct from Neon control-plane credentials. Give observation integrations the narrowest available project-scoped access; grant write access only for an authorized task and target. Verify actual role capabilities and credential scope in the account. Do not store a personal all-project API token on the VPS or give agents routine participant-database access.

An MCP/CLI integration is optional convenience, not a substitute for SSH controls, SQL grants, task authorization or audit. Review its installed capabilities and permission scope before connecting it to production; never auto-run the workspace recipe against the production branch as a setup shortcut.
