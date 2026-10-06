-- Independent sign-in methods and opaque one-use proofs; all secrets stay private.
CREATE TABLE credentials (
 id uuid PRIMARY KEY REFERENCES users(id), "userId" uuid NOT NULL UNIQUE REFERENCES users(id),
 email text NOT NULL UNIQUE, "passwordHash" text NOT NULL, verified boolean NOT NULL,
 CHECK(id="userId")
);
CREATE TABLE identities (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), provider text NOT NULL CHECK(provider IN ('google','discord')),
 subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 255), UNIQUE(provider,subject), UNIQUE("userId",provider)
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), "tokenHash" text NOT NULL UNIQUE, "csrfHash" text NOT NULL,
 "authenticatedAt" timestamptz NOT NULL, "expiresAt" timestamptz NOT NULL, "revokedAt" timestamptz
);
CREATE INDEX sessions_owner ON sessions("userId",id);
CREATE TABLE auth_tokens (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('verify','recover')),
 "tokenHash" text NOT NULL UNIQUE, "expiresAt" timestamptz NOT NULL, "usedAt" timestamptz
);
CREATE TABLE oauth_states (
 id uuid PRIMARY KEY, provider text NOT NULL CHECK(provider IN ('google','discord')), "userId" uuid REFERENCES users(id),
 "stateHash" text NOT NULL UNIQUE, "browserHash" text NOT NULL, nonce text NOT NULL, verifier text NOT NULL,
 "expiresAt" timestamptz NOT NULL, "usedAt" timestamptz
);
CREATE TABLE erasure_requests (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id), "requestedAt" timestamptz NOT NULL, "processedAt" timestamptz
);
-- UUID tombstones prevent erased accounts from returning when a backup is restored.
-- Do not retain email addresses, provider subjects, entropy or identity fingerprints.
CREATE TABLE deletion_ledger ("userId" uuid PRIMARY KEY, "erasedAt" timestamptz NOT NULL);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='challenge_tracker_app') THEN CREATE ROLE challenge_tracker_app NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='challenge_tracker_erasure') THEN CREATE ROLE challenge_tracker_erasure NOLOGIN; END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO challenge_tracker_app;
GRANT SELECT,INSERT,UPDATE ON users,seasons,enrollments,slots,attempts,goals,milestones,reports,credits,grants,replays,outbox,audit,credentials,identities,sessions,auth_tokens,oauth_states,erasure_requests TO challenge_tracker_app;
GRANT SELECT,INSERT ON goal_revisions,milestone_revisions,entitlements TO challenge_tracker_app;
GRANT SELECT,INSERT,DELETE ON report_goal_values TO challenge_tracker_app;
GRANT DELETE ON slots,replays,credentials,identities,sessions,auth_tokens,oauth_states TO challenge_tracker_app;
REVOKE UPDATE ON users FROM challenge_tracker_app;
GRANT UPDATE("updatedAt") ON users TO challenge_tracker_app;
REVOKE ALL ON deletion_ledger FROM challenge_tracker_app;
CREATE OR REPLACE FUNCTION protect_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' OR current_setting('tracker.erasure', true) IS DISTINCT FROM 'authorized' OR NOT pg_has_role(current_user,'challenge_tracker_erasure','USAGE') THEN
  RAISE EXCEPTION 'Completion facts are immutable' USING ERRCODE = '42501';
 END IF;
 RETURN OLD;
END $$;
CREATE FUNCTION erase_tracker_account(account_id uuid, request_id uuid, queue_schema text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE resources uuid[];
BEGIN
 PERFORM 1 FROM public.users WHERE id=account_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.erasure_requests WHERE id=request_id AND "userId"=account_id AND "processedAt" IS NULL) THEN RAISE EXCEPTION 'Erasure request invalid' USING ERRCODE='42501'; END IF;
 SELECT array_agg(id) INTO resources FROM (
  SELECT id FROM public.enrollments WHERE "userId"=account_id UNION ALL
  SELECT a.id FROM public.attempts a JOIN public.enrollments e ON e.id=a."enrollmentId" WHERE e."userId"=account_id UNION ALL
  SELECT r.id FROM public.reports r JOIN public.attempts a ON a.id=r."attemptId" JOIN public.enrollments e ON e.id=a."enrollmentId" WHERE e."userId"=account_id UNION ALL
  SELECT id FROM public.grants WHERE "userId"=account_id
 ) scope;
 IF queue_schema IS NOT NULL THEN
  IF queue_schema !~ '^[a-z][a-z0-9_]{0,62}$' THEN RAISE EXCEPTION 'Queue schema invalid'; END IF;
  IF to_regclass(format('%I.job',queue_schema)) IS NOT NULL THEN EXECUTE format('DELETE FROM %I.job WHERE data->>''aggregateId'' = ANY($1)',queue_schema) USING resources::text[]; END IF;
 END IF;
 DELETE FROM public.outbox WHERE "aggregateId"=ANY(resources);
 DELETE FROM public.audit WHERE "actorId"=account_id OR "aggregateId"=ANY(resources);
 DELETE FROM public.grants WHERE "userId"=account_id;
 DELETE FROM public.replays WHERE "userId"=account_id;
 DELETE FROM public.sessions WHERE "userId"=account_id;
 DELETE FROM public.auth_tokens WHERE "userId"=account_id;
 DELETE FROM public.oauth_states WHERE "userId"=account_id;
 DELETE FROM public.identities WHERE "userId"=account_id;
 DELETE FROM public.credentials WHERE "userId"=account_id;
 DELETE FROM public.slots WHERE id=account_id;
 UPDATE public.enrollments SET "currentAttemptId"=NULL WHERE "userId"=account_id;
 PERFORM set_config('tracker.erasure','authorized',true);
 DELETE FROM public.entitlements WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id);
 DELETE FROM public.credits WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.report_goal_values WHERE attempt_id IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.reports WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 -- Revision-pointer constraints are deferred, so retained parent/child graphs can be erased together.
 DELETE FROM public.milestone_revisions WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.milestones WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.goal_revisions WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.goals WHERE "attemptId" IN(SELECT id FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id));
 DELETE FROM public.attempts WHERE "enrollmentId" IN(SELECT id FROM public.enrollments WHERE "userId"=account_id);
 DELETE FROM public.enrollments WHERE "userId"=account_id;
 DELETE FROM public.erasure_requests WHERE "userId"=account_id;
 DELETE FROM public.users WHERE id=account_id;
 INSERT INTO public.deletion_ledger VALUES(account_id,clock_timestamp()) ON CONFLICT("userId") DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION erase_tracker_account(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erase_tracker_account(uuid,uuid,text) TO challenge_tracker_erasure;
