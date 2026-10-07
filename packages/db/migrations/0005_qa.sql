-- Additive QA foundation. Unknown legacy publication dates remain explicit, never guessed.
CREATE TABLE profiles (
 id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 username text NOT NULL CHECK(username ~ '^[a-z0-9_-]{3,32}$'),
 provisional boolean NOT NULL DEFAULT false,
 avatar text CHECK(length(avatar)<=400000),
 "recoveryEmail" text, "pendingEmail" text
);
CREATE UNIQUE INDEX profiles_username ON profiles(lower(username));
INSERT INTO profiles(id,username,provisional,"recoveryEmail")
 SELECT u.id,'user-'||substr(replace(u.id::text,'-',''),1,26),true,c.email
 FROM users u LEFT JOIN credentials c ON c."userId"=u.id AND c.verified;
CREATE TABLE notifications (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message text NOT NULL, href text NOT NULL, "createdAt" timestamptz NOT NULL,
 "readAt" timestamptz, "dismissedAt" timestamptz
);
CREATE INDEX notifications_owner ON notifications("userId","createdAt");
ALTER TABLE sessions ADD device text NOT NULL DEFAULT 'Unknown browser';
ALTER TABLE erasure_requests ADD "deleteAfter" timestamptz, ADD "cancelledAt" timestamptz;
UPDATE erasure_requests SET "deleteAfter"="requestedAt"+interval '7 days';
ALTER TABLE erasure_requests ALTER "deleteAfter" SET NOT NULL;
ALTER TABLE erasure_requests ALTER "deleteAfter" SET DEFAULT (now()+interval '7 days');
CREATE TABLE account_mail (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 "requestId" uuid NOT NULL UNIQUE REFERENCES erasure_requests(id) ON DELETE CASCADE,
 "sentAt" timestamptz, "nextAttemptAt" timestamptz NOT NULL, failures integer NOT NULL DEFAULT 0
);
ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_kind_check;
ALTER TABLE auth_tokens ADD CHECK(kind IN ('verify','recover','recovery_email'));
GRANT SELECT,INSERT,UPDATE ON profiles,notifications,account_mail TO challenge_tracker_app;
ALTER TABLE seasons ADD slug text, ADD "publishedAt" timestamptz;
UPDATE seasons SET slug='season-'||id::text;
UPDATE seasons s SET "publishedAt"=(SELECT min(a."occurredAt") FROM audit a WHERE a.action='PublishSeason' AND a."aggregateId"=s.id) WHERE s.state='published';
ALTER TABLE seasons ALTER slug SET NOT NULL;
ALTER TABLE seasons ADD UNIQUE(slug), ADD CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE enrollments ADD "registeredDate" date, ADD "releaseOn" date;
UPDATE enrollments SET "registeredDate"=("createdAt" AT TIME ZONE coalesce(timezone,'Africa/Nairobi'))::date;
ALTER TABLE enrollments ALTER "registeredDate" SET NOT NULL;
ALTER TABLE attempts ADD "pausedAt" timestamptz, ADD "streakAfter" date, ADD "backfillUntil" timestamptz, ADD erased boolean NOT NULL DEFAULT false;
-- Original cancelled records were resumable pauses; preserve their history and credits.
UPDATE enrollments SET participation='paused' WHERE participation='cancelled';
ALTER TABLE attempts DROP CONSTRAINT attempts_status_check;
ALTER TABLE attempts ADD CHECK(status IN ('active','paused','cancelled','restarted','completed'));
UPDATE attempts SET status='paused' WHERE status='cancelled';
-- Report dates and indices are reordered atomically during privileged history edits.
ALTER TABLE reports DROP CONSTRAINT "reports_attemptId_reportingIndex_key";
ALTER TABLE reports ADD UNIQUE("attemptId","reportingIndex") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE grants DROP CONSTRAINT grants_kind_check;
ALTER TABLE grants DROP CONSTRAINT grants_check;
ALTER TABLE grants ADD CHECK(kind IN ('single_report','attempt_window','backfill'));
ALTER TABLE grants ADD CHECK((kind='single_report' AND "reportId" IS NOT NULL AND "expiresAt" <= "createdAt"+interval '24 hours') OR (kind='attempt_window' AND "reportId" IS NULL AND "expiresAt" <= "createdAt"+interval '1 hour') OR (kind='backfill' AND "reportId" IS NULL AND "expiresAt" <= "createdAt"+interval '24 hours'));
-- The operation deliberately cannot erase completed attempts or earlier retained attempts.
CREATE FUNCTION erase_cancelled_attempt(account_id uuid, attempt_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=account_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM attempts a JOIN enrollments e ON e.id=a."enrollmentId" WHERE a.id=attempt_id AND e."userId"=account_id AND e."currentAttemptId"=a.id AND a.status='cancelled' AND e.participation='cancelled') OR EXISTS(SELECT 1 FROM entitlements WHERE "attemptId"=attempt_id) THEN RAISE EXCEPTION 'Attempt erasure forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM grants WHERE "attemptId"=attempt_id;
 DELETE FROM credits WHERE "attemptId"=attempt_id;
 DELETE FROM report_goal_values WHERE report_goal_values.attempt_id=erase_cancelled_attempt.attempt_id;
 DELETE FROM reports WHERE "attemptId"=attempt_id;
 DELETE FROM milestone_revisions WHERE "attemptId"=attempt_id;
 DELETE FROM milestones WHERE "attemptId"=attempt_id;
 DELETE FROM goal_revisions WHERE "attemptId"=attempt_id;
 DELETE FROM goals WHERE "attemptId"=attempt_id;
 UPDATE attempts SET "initialGoals"='[]',"initialMilestones"='[]',"baseSeed"=decode(repeat('00',32),'hex'),"initialInputDigest"=decode(repeat('00',32),'hex'),erased=true WHERE id=attempt_id;
END $$;
REVOKE ALL ON FUNCTION erase_cancelled_attempt(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erase_cancelled_attempt(uuid,uuid) TO challenge_tracker_app;
-- Restrict privileged account erasure at the database boundary, including operator calls.
ALTER FUNCTION erase_tracker_account(uuid,uuid,text) RENAME TO erase_tracker_account_unchecked;
REVOKE ALL ON FUNCTION erase_tracker_account_unchecked(uuid,uuid,text) FROM PUBLIC,challenge_tracker_erasure;
CREATE FUNCTION erase_tracker_account(account_id uuid,request_id uuid,queue_schema text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=account_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM erasure_requests WHERE id=request_id AND "userId"=account_id AND "cancelledAt" IS NULL AND "deleteAfter"<=clock_timestamp()) AND NOT EXISTS(SELECT 1 FROM deletion_ledger WHERE "userId"=account_id) THEN RAISE EXCEPTION 'Erasure is not due' USING ERRCODE='42501'; END IF;
 PERFORM erase_tracker_account_unchecked(account_id,request_id,queue_schema);
END $$;
REVOKE ALL ON FUNCTION erase_tracker_account(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erase_tracker_account(uuid,uuid,text) TO challenge_tracker_erasure;
