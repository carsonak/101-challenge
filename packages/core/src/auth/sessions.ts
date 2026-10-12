import type { Repository } from "../model.js";
import type { createAuthSession } from "./session.js";

/** Build sessions behavior using the owning service dependencies. */
export function createAuthSessions(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
}) {
  const { repository, session } = context;
  return {
    /** Owner-only session history with coarse device labels and no bearer secrets. */
    async sessions(token?: string) {
      return repository.transaction(async (tx) => {
        const { user, saved } = await session(tx, token);
        return (await tx.list("sessions", { userId: user.id })).map((s) => ({
          id: s.id,
          device: s.device ?? "Unknown browser",
          authenticatedAt: s.authenticatedAt,
          expiresAt: s.expiresAt,
          revokedAt: s.revokedAt,
          current: s.id === saved.id,
        }));
      });
    },
  };
}
