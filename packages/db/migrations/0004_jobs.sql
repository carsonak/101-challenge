-- Delivery leases and content-free, idempotent projection receipts.
ALTER TABLE outbox ADD COLUMN "leasedUntil" timestamptz, ADD COLUMN "lastFailureAt" timestamptz;
CREATE TABLE event_receipts (id uuid PRIMARY KEY REFERENCES outbox(id) ON DELETE CASCADE, "processedAt" timestamptz NOT NULL);
CREATE TABLE source_projections (
 "attemptId" uuid PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
 "sourceVersion" integer NOT NULL, state text NOT NULL, "reportingDays" integer NOT NULL, "checkedAt" timestamptz NOT NULL
);
REVOKE ALL ON event_receipts,source_projections FROM challenge_tracker_app;
GRANT SELECT ON tracker_migrations TO challenge_tracker_app;
