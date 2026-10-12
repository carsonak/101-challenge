import type { Repository } from "../model.js";
import type { createAuthSession } from "./session.js";
import { ensure } from "./shared.js";

/** Build authenticate behavior using the owning service dependencies. */
export function createAuthAuthenticate(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
}) {
  const { repository, session } = context;
  return {
    /** Authorize a browser session; optionally verify CSRF/recent proof before mutations. */
    async authenticate(token?: string, csrf?: string, recent = false) {
      return repository.transaction(async (tx) => {
        const { user, saved } = await session(tx, token, csrf, recent);
        ensure(
          !(
            await tx.list("erasure_requests", {
              userId: user.id,
              processedAt: null,
            })
          ).some((r) => !r.cancelledAt),
          "FORBIDDEN"
        );

        return { userId: user.id, admin: user.admin, sessionId: saved.id };
      });
    },
  };
}
