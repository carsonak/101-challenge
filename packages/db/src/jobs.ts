import pg from "pg";
import { trackerEventSchema } from "@challenge/contracts";

/** Metadata-only durable event envelope. */
type Event = ReturnType<typeof trackerEventSchema.parse>;
/** Worker-owned storage; use a dedicated database principal/queue and close at shutdown. */
export function createJobStore(
  connectionString: string,
  now: () => Date = () => new Date()
) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  pool.on("error", () => console.error("Worker database unavailable"));
  return {
    /** Require every tracker migration before handlers or readiness are enabled. */
    async ready() {
      const r = await pool.query(
        "SELECT count(*)::int AS count FROM tracker_migrations WHERE version IN(1,2,3,4,5,6)"
      );
      if (r.rows[0]?.count !== 6)
        throw Object.assign(new Error("Tracker migrations required"), {
          code: "MIGRATIONS_REQUIRED",
        });
    },
    /** Claim pending events with leases; publish failures retain metadata and bounded backoff. */
    async publish(publish: (event: Event) => Promise<void>) {
      const rows = (
        await pool.query(`WITH pending AS (SELECT id FROM outbox WHERE "publishedAt" IS NULL AND deliveries<8 AND ("leasedUntil" IS NULL OR "leasedUntil"<=now()) ORDER BY "occurredAt",id FOR UPDATE SKIP LOCKED LIMIT 20)
        UPDATE outbox o SET "leasedUntil"=now()+interval '1 minute',deliveries=o.deliveries+1 FROM pending p WHERE o.id=p.id RETURNING o.*`)
      ).rows;
      let delivered = 0,
        failed = 0;
      for (const row of rows) {
        const event = trackerEventSchema.parse({
          eventId: row.id,
          type: row.type,
          schemaVersion: 1,
          aggregateId: row.aggregateId,
          sourceVersion: row.sourceVersion,
          occurredAt: row.occurredAt.toISOString(),
        });
        try {
          await publish(event);
          await pool.query(
            'UPDATE outbox SET "publishedAt"=now(),"leasedUntil"=NULL WHERE id=$1 AND "publishedAt" IS NULL',
            [row.id]
          );
          delivered++;
        } catch {
          await pool.query(
            `UPDATE outbox SET "lastFailureAt"=now(),"leasedUntil"=now()+make_interval(secs=>least(3600,5*power(2,deliveries)::int)) WHERE id=$1`,
            [row.id]
          );
          failed++;
        }
      }
      return { delivered, failed };
    },
    /** Reload current attempt state transactionally; stale, erased and duplicate deliveries have no logical effect. */
    async process(input: unknown) {
      const event = trackerEventSchema.parse(input),
        client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Take the account lock before attempt/outbox, matching command and erasure order.
        if (event.type === "source_changed")
          await client.query(
            'SELECT u.id FROM users u JOIN enrollments e ON e."userId"=u.id JOIN attempts a ON a."enrollmentId"=e.id WHERE a.id=$1 FOR UPDATE OF u',
            [event.aggregateId]
          );
        const persisted = (
          await client.query("SELECT * FROM outbox WHERE id=$1 FOR UPDATE", [
            event.eventId,
          ])
        ).rows[0];
        if (
          !persisted ||
          persisted.aggregateId !== event.aggregateId ||
          persisted.sourceVersion !== event.sourceVersion ||
          persisted.type !== event.type
        ) {
          await client.query("COMMIT");
          return "ignored";
        }
        const inserted = await client.query(
          "INSERT INTO event_receipts VALUES($1,now()) ON CONFLICT DO NOTHING RETURNING id",
          [event.eventId]
        );
        if (!inserted.rowCount) {
          await client.query("COMMIT");
          return "duplicate";
        }
        if (event.type === "source_changed") {
          const attempt = (
            await client.query(
              "SELECT * FROM attempts WHERE id=$1 FOR UPDATE",
              [event.aggregateId]
            )
          ).rows[0];
          if (attempt && attempt.sourceVersion === event.sourceVersion) {
            const count = (
              await client.query(
                'SELECT count(*)::int AS count FROM reports WHERE "attemptId"=$1',
                [event.aggregateId]
              )
            ).rows[0].count;
            await client.query(
              `INSERT INTO source_projections VALUES($1,$2,$3,$4,now()) ON CONFLICT("attemptId") DO UPDATE SET "sourceVersion"=EXCLUDED."sourceVersion",state=EXCLUDED.state,"reportingDays"=EXCLUDED."reportingDays","checkedAt"=now() WHERE source_projections."sourceVersion"<=EXCLUDED."sourceVersion"`,
              [attempt.id, attempt.sourceVersion, attempt.status, count]
            );
          }
        }
        await client.query("COMMIT");
        return "processed";
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    /** Delete expired authentication/replay/form proofs; expired grants remain marked unusable in retained audit metadata. */
    async housekeeping() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const table of [
          "sessions",
          "auth_tokens",
          "oauth_states",
          "replays",
          "adapter_confirmations",
        ])
          await client.query(`DELETE FROM ${table} WHERE "expiresAt"<=$1`, [
            now(),
          ]);
        await client.query(
          `DELETE FROM grants WHERE "expiresAt"<$1::timestamptz-interval '30 days'`,
          [now()]
        );
        await client.query(
          `DELETE FROM outbox WHERE "publishedAt"<$1::timestamptz-interval '30 days'`,
          [now()]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    /** Inspect one content-free projection for maintenance verification. */
    async projection(attemptId: string) {
      return (
        await pool.query(
          'SELECT * FROM source_projections WHERE "attemptId"=$1',
          [attemptId]
        )
      ).rows[0] as
        | { sourceVersion: number; state: string; reportingDays: number }
        | undefined;
    },
    /** Inspect terminal event IDs/attempt counts only, never supplied exception strings or source text. */
    async failures() {
      return (
        await pool.query(
          'SELECT id,type,"aggregateId",deliveries,"lastFailureAt" FROM outbox WHERE "publishedAt" IS NULL AND deliveries>=8 ORDER BY id'
        )
      ).rows;
    },
    /** Release worker-owned connections; do not reuse afterward. */
    async close() {
      await pool.end();
    },
  };
}
