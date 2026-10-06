-- Clean initial tracker migration; private inputs never enter public projections.
CREATE TABLE users (
 "id" uuid PRIMARY KEY,
 "participantSeed" bytea NOT NULL CHECK(octet_length("participantSeed") = 32),
 "admin" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE seasons (
 "id" uuid PRIMARY KEY,
 "title" text NOT NULL,
 "description" text,
 "state" text NOT NULL,
 "featured" boolean NOT NULL,
 "seasonSeed" bytea NOT NULL CHECK(octet_length("seasonSeed") = 32),
 "goals" jsonb NOT NULL,
 "milestones" jsonb NOT NULL,
 "sessionUrl" text,
 "version" integer NOT NULL CHECK("version" >= 0),
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE enrollments (
 "id" uuid PRIMARY KEY,
 "userId" uuid NOT NULL,
 "seasonId" uuid NOT NULL,
 "participation" text NOT NULL,
 "timezone" text,
 "currentAttemptId" uuid,
 "hasCompleted" boolean NOT NULL,
 "version" integer NOT NULL CHECK("version" >= 0),
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE slots (
 "id" uuid PRIMARY KEY,
 "enrollmentId" uuid NOT NULL
);
CREATE TABLE attempts (
 "id" uuid PRIMARY KEY,
 "enrollmentId" uuid NOT NULL,
 "sequence" integer NOT NULL CHECK("sequence" >= 0),
 "status" text NOT NULL,
 "mode" text NOT NULL,
 "baseSeed" bytea NOT NULL CHECK(octet_length("baseSeed") = 32),
 "seedVersion" text NOT NULL,
 "initialInputDigest" bytea NOT NULL CHECK(octet_length("initialInputDigest") = 32),
 "initialGoals" jsonb NOT NULL,
 "initialMilestones" jsonb NOT NULL,
 "startedAt" timestamptz NOT NULL,
 "sourceVersion" integer NOT NULL CHECK("sourceVersion" >= 0),
 "version" integer NOT NULL CHECK("version" >= 0),
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE goals (
 "id" uuid PRIMARY KEY,
 "attemptId" uuid NOT NULL,
 "currentRevisionId" uuid NOT NULL,
 "archived" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE goal_revisions (
 "id" uuid PRIMARY KEY,
 "goalId" uuid NOT NULL,
 "attemptId" uuid NOT NULL,
 "input" jsonb NOT NULL,
 "archived" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL
);
CREATE TABLE milestones (
 "id" uuid PRIMARY KEY,
 "attemptId" uuid NOT NULL,
 "currentRevisionId" uuid NOT NULL,
 "archived" boolean NOT NULL,
 "locked" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE milestone_revisions (
 "id" uuid PRIMARY KEY,
 "milestoneId" uuid NOT NULL,
 "attemptId" uuid NOT NULL,
 "input" jsonb NOT NULL,
 "archived" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL
);
CREATE TABLE reports (
 "id" uuid PRIMARY KEY,
 "attemptId" uuid NOT NULL,
 "reportingDate" date NOT NULL,
 "reportingIndex" integer NOT NULL CHECK("reportingIndex" >= 0),
 "body" text NOT NULL,
 "goalValues" jsonb NOT NULL,
 "applicableGoalRevisionIds" jsonb NOT NULL,
 "streakAtReport" integer NOT NULL CHECK("streakAtReport" >= 0),
 "selectedPerks" jsonb NOT NULL,
 "milestoneFacts" jsonb NOT NULL,
 "version" integer NOT NULL CHECK("version" >= 0),
 "createdAt" timestamptz NOT NULL,
 "updatedAt" timestamptz NOT NULL
);
CREATE TABLE credits (
 "id" uuid PRIMARY KEY,
 "attemptId" uuid NOT NULL,
 "earningReportId" uuid NOT NULL,
 "ruleVersion" integer NOT NULL CHECK("ruleVersion" >= 0),
 "expired" boolean NOT NULL,
 "createdAt" timestamptz NOT NULL
);
CREATE TABLE entitlements (
 "id" uuid PRIMARY KEY,
 "enrollmentId" uuid NOT NULL,
 "attemptId" uuid NOT NULL,
 "completedAt" timestamptz NOT NULL,
 "reportingDates" jsonb NOT NULL
);
CREATE TABLE grants (
 "id" uuid PRIMARY KEY,
 "userId" uuid NOT NULL,
 "attemptId" uuid NOT NULL,
 "reportId" uuid,
 "kind" text NOT NULL,
 "tokenHash" text NOT NULL,
 "expiresAt" timestamptz NOT NULL,
 "usedAt" timestamptz,
 "revokedAt" timestamptz,
 "createdAt" timestamptz NOT NULL
);
CREATE TABLE replays (
 "id" uuid PRIMARY KEY,
 "userId" uuid NOT NULL,
 "command" text NOT NULL,
 "key" text NOT NULL,
 "requestHash" text NOT NULL,
 "resourceId" uuid NOT NULL,
 "version" integer NOT NULL CHECK("version" >= 0),
 "expiresAt" timestamptz NOT NULL
);
CREATE TABLE outbox (
 "id" uuid PRIMARY KEY,
 "type" text NOT NULL,
 "aggregateId" uuid NOT NULL,
 "sourceVersion" integer NOT NULL CHECK("sourceVersion" >= 0),
 "occurredAt" timestamptz NOT NULL,
 "publishedAt" timestamptz,
 "deliveries" integer NOT NULL CHECK("deliveries" >= 0)
);
CREATE TABLE audit (
 "id" uuid PRIMARY KEY,
 "actorId" uuid NOT NULL,
 "action" text NOT NULL,
 "aggregateId" uuid NOT NULL,
 "occurredAt" timestamptz NOT NULL
);

ALTER TABLE enrollments ADD FOREIGN KEY("userId") REFERENCES users(id), ADD FOREIGN KEY("seasonId") REFERENCES seasons(id), ADD UNIQUE("userId","seasonId"), ADD UNIQUE(id,"userId");
ALTER TABLE slots ADD FOREIGN KEY(id) REFERENCES users(id), ADD FOREIGN KEY("enrollmentId",id) REFERENCES enrollments(id,"userId");
ALTER TABLE attempts ADD FOREIGN KEY("enrollmentId") REFERENCES enrollments(id), ADD UNIQUE("enrollmentId",sequence), ADD UNIQUE(id,"enrollmentId"), ADD CHECK(status IN ('active','cancelled','restarted','completed')), ADD CHECK(mode IN ('qualifying','progress_only'));
CREATE UNIQUE INDEX attempts_one_current ON attempts("enrollmentId") WHERE status IN ('active','cancelled');
ALTER TABLE enrollments ADD FOREIGN KEY("currentAttemptId",id) REFERENCES attempts(id,"enrollmentId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE goals ADD FOREIGN KEY("attemptId") REFERENCES attempts(id), ADD UNIQUE(id,"attemptId");
ALTER TABLE goal_revisions ADD FOREIGN KEY("goalId","attemptId") REFERENCES goals(id,"attemptId"), ADD UNIQUE(id,"attemptId"), ADD UNIQUE(id,"goalId");
ALTER TABLE goals ADD FOREIGN KEY("currentRevisionId",id) REFERENCES goal_revisions(id,"goalId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE milestones ADD FOREIGN KEY("attemptId") REFERENCES attempts(id), ADD UNIQUE(id,"attemptId");
ALTER TABLE milestone_revisions ADD FOREIGN KEY("milestoneId","attemptId") REFERENCES milestones(id,"attemptId"), ADD UNIQUE(id,"milestoneId"), ADD UNIQUE(id,"attemptId");
ALTER TABLE milestones ADD FOREIGN KEY("currentRevisionId",id) REFERENCES milestone_revisions(id,"milestoneId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE reports ADD FOREIGN KEY("attemptId") REFERENCES attempts(id), ADD UNIQUE("attemptId","reportingDate"), ADD UNIQUE("attemptId","reportingIndex"), ADD UNIQUE(id,"attemptId"), ADD CHECK("reportingIndex" BETWEEN 1 AND 101);
CREATE TABLE report_goal_values (
 report_id uuid NOT NULL, attempt_id uuid NOT NULL, goal_revision_id uuid NOT NULL,
 value numeric NOT NULL CHECK(value >= 0 AND scale(value) <= 6 AND length(replace(value::text,'.','')) <= 18),
 PRIMARY KEY(report_id,goal_revision_id), FOREIGN KEY(report_id,attempt_id) REFERENCES reports(id,"attemptId"), FOREIGN KEY(goal_revision_id,attempt_id) REFERENCES goal_revisions(id,"attemptId")
);
ALTER TABLE credits ADD FOREIGN KEY("attemptId") REFERENCES attempts(id), ADD FOREIGN KEY("earningReportId","attemptId") REFERENCES reports(id,"attemptId"), ADD UNIQUE("earningReportId","ruleVersion");
ALTER TABLE entitlements ADD FOREIGN KEY("enrollmentId") REFERENCES enrollments(id), ADD UNIQUE("enrollmentId"), ADD FOREIGN KEY("attemptId","enrollmentId") REFERENCES attempts(id,"enrollmentId"), ADD CHECK(jsonb_array_length("reportingDates")=101);
ALTER TABLE grants ADD FOREIGN KEY("userId") REFERENCES users(id), ADD FOREIGN KEY("attemptId") REFERENCES attempts(id), ADD FOREIGN KEY("reportId","attemptId") REFERENCES reports(id,"attemptId"), ADD UNIQUE("tokenHash"), ADD CHECK(kind IN ('single_report','attempt_window')), ADD CHECK((kind='single_report' AND "reportId" IS NOT NULL AND "expiresAt" <= "createdAt" + interval '24 hours') OR (kind='attempt_window' AND "reportId" IS NULL AND "expiresAt" <= "createdAt" + interval '1 hour'));
ALTER TABLE replays ADD FOREIGN KEY("userId") REFERENCES users(id), ADD UNIQUE("userId",command,key);
CREATE INDEX goals_owner ON goals("attemptId",id);
CREATE INDEX goal_revisions_owner ON goal_revisions("attemptId",id);
CREATE INDEX milestones_owner ON milestones("attemptId",id);
CREATE INDEX milestone_revisions_owner ON milestone_revisions("attemptId",id);
CREATE INDEX reports_cursor ON reports("attemptId","reportingDate",id);
CREATE INDEX grants_recipient ON grants("userId",id);
CREATE INDEX outbox_pending ON outbox("publishedAt",id);
CREATE FUNCTION protect_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' OR current_setting('tracker.erasure', true) IS DISTINCT FROM 'authorized' THEN
  RAISE EXCEPTION 'Completion facts are immutable' USING ERRCODE = '42501';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER entitlement_immutable BEFORE UPDATE OR DELETE ON entitlements FOR EACH ROW EXECUTE FUNCTION protect_entitlement();
