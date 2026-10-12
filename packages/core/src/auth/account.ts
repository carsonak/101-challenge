import { accountSchema } from "@challenge/contracts";
import type { Repository } from "../model.js";
import type { createAuthSession } from "./session.js";
import { ensure } from "./shared.js";

/** Build account behavior using the owning service dependencies. */
export function createAuthAccount(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
}) {
  const { repository, session } = context;
  return {
    /** Return account settings with no secret credential/provider/session fields. */
    async account(token?: string) {
      return repository.transaction(async (tx) => {
        const { user } = await session(tx, token);
        const credential = await tx.get("credentials", user.id);
        const identities = await tx.list("identities", { userId: user.id });
        const profile = await tx.get("profiles", user.id);
        ensure(profile);
        const deletion = (
          await tx.list("erasure_requests", {
            userId: user.id,
            processedAt: null,
          })
        ).find((r) => !r.cancelledAt);

        return accountSchema.parse({
          username: profile.username,
          provisional: profile.provisional,
          avatar: profile.avatar,
          recoveryEmail: profile.recoveryEmail,
          deletion: deletion
            ? {
                requestedAt: deletion.requestedAt,
                deleteAfter: deletion.deleteAfter,
              }
            : null,
          id: user.id,
          email: credential?.email ?? null,
          emailVerified: credential?.verified ?? false,
          providers: identities.map((i) => i.provider),
          admin: user.admin,
        });
      });
    },
  };
}
