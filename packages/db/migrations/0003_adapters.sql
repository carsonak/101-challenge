-- Private actor-bound modal/confirmation metadata; never store submitted report text here.
CREATE TABLE adapter_confirmations (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('setup','update','edit','cancel','restart')),
 "resourceId" uuid NOT NULL, version integer NOT NULL CHECK(version>=0),
 "enrollmentId" uuid NOT NULL, "enrollmentVersion" integer NOT NULL CHECK("enrollmentVersion">=0),
 "expiresAt" timestamptz NOT NULL
);
GRANT SELECT,INSERT ON adapter_confirmations TO challenge_tracker_app;
