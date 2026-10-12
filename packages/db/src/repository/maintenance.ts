import type { QueryResult } from "pg";
import type pg from "pg";
/** Build maintenance operations using the owning repository pool. */
export function createMaintenance(context: {
  /** Pool owned and closed by the repository. */ pool: pg.Pool;
  /** Privileged access is unavailable to application-role handles. */ applicationRole: boolean;
  /** Application-role transaction query. */ adapterQuery: (
    text: string,
    values: unknown[]
  ) => Promise<QueryResult>;
}) {
  const { pool, applicationRole } = context;
  return {
    /** Execute only an owner-confirmed erasure request using privileged database credentials. */
    async eraseAccount(
      userId: string,
      requestId: string,
      queueSchema?: string
    ) {
      if (applicationRole)
        throw Object.assign(new Error("Erasure credentials required"), {
          code: "42501",
        });

      await pool.query("SELECT erase_tracker_account($1,$2,$3)", [
        userId,
        requestId,
        queueSchema ?? null,
      ]);
    },
    /** Content-free deletion ledger for trusted backup/restore tooling; never expose as an API. */
    async deletionLedger() {
      if (applicationRole)
        throw Object.assign(new Error("Ledger credentials required"), {
          code: "42501",
        });

      return (
        await pool.query(
          'SELECT "userId", "erasedAt" FROM deletion_ledger ORDER BY "userId"'
        )
      ).rows as { userId: string; erasedAt: Date }[];
    },
    /** Deliver scheduled deletion notices with retries and erase due accounts; use a dedicated privileged process. */
    async maintainAccounts(
      send: (recipient: string) => Promise<void>,
      queueSchema?: string,
      requestId?: string
    ) {
      if (applicationRole)
        throw Object.assign(new Error("Maintenance credentials required"), {
          code: "42501",
        });

      const notices = (
        await pool.query(
          'SELECT id,"userId" FROM account_mail WHERE "sentAt" IS NULL AND "nextAttemptAt"<=now() AND ($1::uuid IS NULL OR "requestId"=$1) LIMIT 50',
          [requestId ?? null]
        )
      ).rows;

      for (const notice of notices) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
            notice.userId,
          ]);

          const job = (
            await client.query(
              'SELECT m.*,p."recoveryEmail",e."cancelledAt" FROM account_mail m JOIN profiles p ON p.id=m."userId" JOIN erasure_requests e ON e.id=m."requestId" WHERE m.id=$1 AND m."sentAt" IS NULL AND m."nextAttemptAt"<=now() FOR UPDATE OF m',
              [notice.id]
            )
          ).rows[0];

          if (job) {
            try {
              if (!job.cancelledAt && job.recoveryEmail)
                await send(job.recoveryEmail);

              await client.query(
                'UPDATE account_mail SET "sentAt"=now() WHERE id=$1',
                [job.id]
              );
            } catch {
              await client.query(
                'UPDATE account_mail SET failures=failures+1,"nextAttemptAt"=now()+make_interval(secs=>least(3600,30*power(2,least(failures,7))::int)) WHERE id=$1',
                [job.id]
              );
            }
          }

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }

      const due = (
        await pool.query(
          'SELECT id,"userId" FROM erasure_requests WHERE "cancelledAt" IS NULL AND "processedAt" IS NULL AND "deleteAfter"<=now() AND ($1::uuid IS NULL OR id=$1)',
          [requestId ?? null]
        )
      ).rows;

      for (const request of due) {
        try {
          await pool.query("SELECT erase_tracker_account($1,$2,$3)", [
            request.userId,
            request.id,
            queueSchema ?? null,
          ]);
        } catch (error) {
          if ((error as { code?: string }).code !== "42501") throw error;
        }
      }
    },
  };
}
