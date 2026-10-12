import type { Transaction } from "../model.js";

/** Build revokeSessions behavior using the owning service dependencies. */
export function createAuthRevokeSessions(context: {
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { clock } = context;
  /** Revoke all sessions after recovery or a sensitive credential change. */
  async function revokeSessions(tx: Transaction, userId: string) {
    for (const row of await tx.list("sessions", { userId })) {
      row.revokedAt = clock().toISOString();
      await tx.save("sessions", row);
    }
  }

  return revokeSessions;
}
