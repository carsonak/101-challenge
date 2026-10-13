import type pg from "pg";
import { notificationRetention } from "@challenge/core";

/** Build bounded proof/inbox cleanup; retention deadlines override adaptive housekeeping intervals. */
export function createHousekeeping(pool: pg.Pool, now: () => Date) {
  return async () => {
    const client = await pool.connect();
    let more = false;
    const instant = now();
    try {
      await client.query("BEGIN");
      for (const table of [
        "sessions",
        "auth_tokens",
        "oauth_states",
        "replays",
        "adapter_confirmations",
        "throttle_buckets",
      ]) {
        const id = table === "throttle_buckets" ? "key" : "id";
        const deleted = await client.query(
          `DELETE FROM ${table} WHERE ${id} IN(SELECT ${id} FROM ${table} WHERE "expiresAt"<=$1 LIMIT 500)`,
          [instant]
        );

        more ||= deleted.rowCount === 500;
      }

      for (const [table, column] of [
        ["grants", "expiresAt"],
        ["outbox", "publishedAt"],
      ]) {
        const deleted = await client.query(
          `DELETE FROM ${table} WHERE id IN(SELECT id FROM ${table} WHERE "${column}"<$1::timestamptz-interval '30 days' LIMIT 500)`,
          [instant]
        );

        more ||= deleted.rowCount === 500;
      }

      const deleted = await client.query(
        `DELETE FROM notifications WHERE id IN(SELECT id FROM notifications WHERE
        (("readAt" IS NOT NULL OR "dismissedAt" IS NOT NULL) AND LEAST("readAt","dismissedAt")<$1::timestamptz-make_interval(days=>$2))
        OR ("readAt" IS NULL AND "dismissedAt" IS NULL AND "createdAt"<$1::timestamptz-make_interval(days=>$3)) LIMIT 500)`,
        [
          instant,
          notificationRetention.acknowledgedDays,
          notificationRetention.unreadDays,
        ]
      );

      more ||= deleted.rowCount === 500;
      const pending = await client.query(
        `SELECT min(due) AS due FROM (
        SELECT min("expiresAt")+interval '30 days' AS due FROM grants
        UNION ALL SELECT min("publishedAt")+interval '30 days' FROM outbox
        UNION ALL SELECT min(coalesce(LEAST("readAt","dismissedAt")+make_interval(days=>$1),"createdAt"+make_interval(days=>$2))) FROM notifications
      ) deadlines`,
        [
          notificationRetention.acknowledgedDays,
          notificationRetention.unreadDays,
        ]
      );

      await client.query("COMMIT");
      return {
        more,
        nextDue: pending.rows[0].due
          ? new Date(pending.rows[0].due).getTime()
          : null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
}
