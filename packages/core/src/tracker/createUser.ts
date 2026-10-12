import type { Repository, User } from "../model.js";

/** Build createUser behavior using the owning service dependencies. */
export function createTrackerCreateUser(context: {
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ id:
    | (() => string)
    | ((options?: import("crypto").RandomUUIDOptions) => import("crypto").UUID);
  /** Shared service dependency. */ secret: () => string;
  /** Shared service dependency. */ repository: Repository;
}) {
  const { clock, id, secret, repository } = context;
  return {
    /** Create an independent private account; authentication provisions usable sign-in methods separately. */
    async createUser(admin = false) {
      const now = clock().toISOString();
      const row: User = {
        id: id(),
        participantSeed: secret(),
        admin,
        createdAt: now,
        updatedAt: now,
      };

      await repository.transaction(async (tx) => {
        await tx.insert("users", row);
        await tx.insert("profiles", {
          id: row.id,
          username: `user-${row.id.replaceAll("-", "").slice(0, 26)}`,
          provisional: true,
          avatar: null,
          recoveryEmail: null,
          pendingEmail: null,
        });
      });

      return row.id;
    },
  };
}
