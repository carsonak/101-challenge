-- Recover previously enqueued work before retiring the continuously polled queue.
-- Stop old workers before applying this migration; receipts preserve logical deduplication.
UPDATE outbox o SET "publishedAt"=NULL,deliveries=0,"leasedUntil"=NULL
 WHERE "publishedAt" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM event_receipts r WHERE r.id=o.id);
CREATE INDEX outbox_due ON outbox("leasedUntil","occurredAt") WHERE "publishedAt" IS NULL AND deliveries<8;
CREATE INDEX account_mail_due ON account_mail("nextAttemptAt") WHERE "sentAt" IS NULL;
CREATE INDEX erasure_requests_due ON erasure_requests("deleteAfter") WHERE "cancelledAt" IS NULL AND "processedAt" IS NULL;

-- Opaque, short-lived counters survive replicas and restarts. No address or email
-- is stored; the private random salt prevents offline dictionary lookup of keys.
CREATE TABLE throttle_secret (id boolean PRIMARY KEY CHECK(id), secret text NOT NULL);
INSERT INTO throttle_secret VALUES(true,gen_random_uuid()::text||gen_random_uuid()::text);
CREATE TABLE throttle_buckets (key text PRIMARY KEY, count integer NOT NULL, "expiresAt" timestamptz NOT NULL);
CREATE INDEX throttle_expiry ON throttle_buckets("expiresAt");
REVOKE ALL ON throttle_secret,throttle_buckets FROM PUBLIC,challenge_tracker_app;
CREATE FUNCTION take_tracker_rate(action text,identity text,maximum integer,window_ms integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE bucket_key text; saved public.throttle_buckets%ROWTYPE; instant timestamptz:=clock_timestamp();
BEGIN
 IF action IS NULL OR identity IS NULL OR maximum IS NULL OR window_ms IS NULL OR
    length(action)>100 OR length(identity)>4096 OR maximum NOT BETWEEN 1 AND 1000 OR window_ms NOT BETWEEN 1 AND 86400000 THEN
   RAISE EXCEPTION 'Invalid rate bucket';
 END IF;
 -- Serialize short reservations across replicas. Never held across password hashing or SMTP.
 PERFORM pg_advisory_xact_lock(101008);
 SELECT encode(sha256(convert_to(secret||length(action)::text||':'||action||identity,'UTF8')),'hex') INTO bucket_key FROM public.throttle_secret WHERE id;
 SELECT * INTO saved FROM public.throttle_buckets WHERE key=bucket_key;
 IF saved.key IS NULL OR saved."expiresAt"<=instant THEN
   IF saved.key IS NULL AND (SELECT count(*) FROM public.throttle_buckets)>=10000 THEN
     DELETE FROM public.throttle_buckets WHERE "expiresAt"<=instant;
     IF (SELECT count(*) FROM public.throttle_buckets)>=10000 THEN RETURN 60; END IF;
   END IF;
   INSERT INTO public.throttle_buckets VALUES(bucket_key,1,instant+make_interval(secs=>window_ms/1000.0))
    ON CONFLICT(key) DO UPDATE SET count=1,"expiresAt"=EXCLUDED."expiresAt";
   RETURN 0;
 END IF;
 IF saved.count>=maximum THEN RETURN greatest(1,ceil(extract(epoch FROM saved."expiresAt"-instant))::integer); END IF;
 UPDATE public.throttle_buckets SET count=count+1 WHERE key=bucket_key;
 RETURN 0;
END $$;
REVOKE ALL ON FUNCTION take_tracker_rate(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION take_tracker_rate(text,text,integer,integer) TO challenge_tracker_app;
