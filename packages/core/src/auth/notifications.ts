import type { Repository } from "../model.js";
import type { createAuthSession } from "./session.js";

/** Build notifications behavior using the owning service dependencies. */
export function createAuthNotifications(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
}) {
  const { repository, session } = context;
  return {
    /** Owner-only inbox; dismissed notifications are excluded. */
    async notifications(token?: string) {
      return repository.transaction(async (tx) => {
        const { user } = await session(tx, token);
        return (
          await tx.list("notifications", { userId: user.id, dismissedAt: null })
        ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
  };
}
