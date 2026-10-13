import { notificationRetention } from "../notification-retention.js";
import type { Repository } from "../model.js";
import type { createAuthSession } from "./session.js";

/** Build notifications behavior using the owning service dependencies. */
export function createAuthNotifications(context: {
  /** Clock for expiry-at-read, independent of cleanup availability. */ clock: () => Date;
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
}) {
  const { repository, session, clock } = context;
  return {
    /** Owner-only inbox; dismissed notifications are excluded. */
    async notifications(token?: string) {
      return repository.transaction(async (tx) => {
        const { user } = await session(tx, token);
        return (
          await tx.list("notifications", { userId: user.id, dismissedAt: null })
        )
          .filter((notice) => {
            const since = notice.readAt ?? notice.createdAt;
            return (
              Date.parse(since) >=
              clock().getTime() -
                (notice.readAt
                  ? notificationRetention.acknowledgedDays
                  : notificationRetention.unreadDays) *
                  86400000
            );
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
  };
}
