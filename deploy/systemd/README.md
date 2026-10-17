# Private host timer examples

Review paths, service identity and tool locations for the actual host before
installing. These files are templates; no timers or alerts are installed by Git.
Use Node matching the manifest, PostgreSQL 17 client tools, age and the AWS CLI.
Build workspace packages before running the scripts. The backup user needs read
access to the built checkout and write access only to `/var/lib/challenge-backups`;
create that directory owned by it with mode 0700. Create `/etc/challenge` root-owned
0700 and environment files 0600, read by systemd. No decryption key belongs here.

`backup.env` supplies BACKUP_DATABASE_URL (a private read-only backup connection),
BACKUP_DIR=/var/lib/challenge-backups, AGE_RECIPIENT, BACKUP_REQUIRE_REMOTE=true,
BACKUP_S3_BUCKET and optional BACKUP_S3_PREFIX/BACKUP_S3_ENDPOINT plus a scoped
storage principal. A remote endpoint must use HTTPS. `operations.env` supplies
OPERATIONS_DATABASE_URL, OPERATIONS_READY_URL and
BACKUP_SUCCESS_FILE=/var/lib/challenge-backups/last-backup.json. The operational
login needs SELECT only on erasure_requests, account_mail and outbox; it must have
no membership in runtime or erasure roles. Both URLs require the private database
network/tunnel; the production Compose database has no host port. Prefer an
isolated backup runner on that network, or an explicitly reviewed loopback-only
DB forwarding arrangement. Do not publish PostgreSQL for these templates.

Before enabling any timer, install an operator-owned
`challenge-alert@.service` that delivers failures to the monitored channel. It
should report the fixed unit name and generic outcome, with rate limiting; do not
forward environment files or raw database errors. Alert delivery is an owner
configuration gate. Test each service manually, including a deliberate failure,
then install units and enable the three timers with `systemctl enable --now`.
Check `systemctl list-timers` and private journal output. Never claim monitoring
is active merely because these templates exist.

The shared flock serializes snapshot/ledger publication. Keep its runtime directory
alive across both units (set RuntimeDirectoryPreserve=yes on both). Daily snapshot
success is recorded only after the dump producer, encryption, upload and current
ledger upload succeed. The freshness check requires a remote-success marker less
than 26 hours old. Ledger-only sweeps never refresh the snapshot marker.

The minute ledger timer bounds the resident maintenance-to-off-server-ledger lag;
it does not prove every erasure has been durably copied. Refresh immediately after
an operator-run maintenance sweep, and before selecting a restore source. Before
accepting hosted erasure durability, demonstrate the chosen maintenance/ledger
ordering and failure alerting. An inaccessible latest ledger blocks restoration
of traffic; never fall back to a snapshot's older ledger. Retain current ledger
versions independently of the thirty-day snapshot lifecycle. Run a timed restore
from off-server storage on a separate machine before invitations.

Use an external uptime monitor as well: a monitor running on the VPS cannot alert
when the VPS itself is down. Route mail_failed, startup_failed, queue_failed,
projection_failed, outbox_failed and sustained HTTP 5xx events from structured
logs to the same monitored channel. Test readiness down, rejected mail, overdue
work, stale backup and complete host outage once each. Keep access tokens, proof
URLs and participant content out of logs/alerts.
