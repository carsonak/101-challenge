-- Operator-only reversible access suspension. Retain history and identity ownership;
-- account erasure cascades this content-free operational flag with its user.
CREATE TABLE account_suspensions (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  "suspendedAt" timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON account_suspensions FROM PUBLIC;
GRANT SELECT ON account_suspensions TO challenge_tracker_app;
