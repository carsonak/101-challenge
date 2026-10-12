import { randomUUID } from "node:crypto";
import type { QueryResult } from "pg";
import type pg from "pg";
/** Build restore operations using the owning repository pool. */
export function createRestore(context: {
  /** Pool owned and closed by the repository. */ pool: pg.Pool;
  /** Privileged access is unavailable to application-role handles. */ applicationRole: boolean;
  /** Application-role transaction query. */ adapterQuery: (
    text: string,
    values: unknown[]
  ) => Promise<QueryResult>;
}) {
  const { pool, applicationRole } = context;
  return {
    /** Replay a trusted content-free deletion ledger after restore, before serving traffic. */
    async replayErasures(userIds: string[], queueSchema?: string) {
      if (applicationRole)
        throw Object.assign(new Error("Restore credentials required"), {
          code: "42501",
        });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const userId of userIds) {
          if (!/^[a-f0-9-]{36}$/.test(userId))
            throw new Error("Invalid deletion ledger");

          if (
            (
              await client.query(
                "SELECT id FROM users WHERE id=$1 FOR UPDATE",
                [userId]
              )
            ).rowCount
          ) {
            const requestId = randomUUID();
            await client.query(
              'INSERT INTO deletion_ledger VALUES($1,clock_timestamp()) ON CONFLICT("userId") DO NOTHING',
              [userId]
            );

            await client.query(
              'INSERT INTO erasure_requests(id,"userId","requestedAt","processedAt") VALUES($1,$2,clock_timestamp(),NULL)',
              [requestId, userId]
            );

            await client.query("SELECT erase_tracker_account($1,$2,$3)", [
              userId,
              requestId,
              queueSchema ?? null,
            ]);
          } else
            await client.query(
              'INSERT INTO deletion_ledger VALUES($1,clock_timestamp()) ON CONFLICT("userId") DO NOTHING',
              [userId]
            );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
