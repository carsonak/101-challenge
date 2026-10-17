import type { Transaction } from "../model.js";
import { digest } from "../rules.js";
import { ensure } from "./shared.js";

/** Build session behavior using the owning service dependencies. */
export function createAuthSession(context: {
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { clock } = context;
  /** Find and lock the authenticated user before session/resource locks. */
  async function session(
    tx: Transaction,
    raw: string | undefined,
    csrf?: string,
    recent = false
  ) {
    ensure(raw && /^[a-f0-9]{64}$/.test(raw));
    const found = (await tx.list("sessions", { tokenHash: digest(raw) }))[0];
    ensure(found);
    const user = await tx.get("users", found.userId, true);
    ensure(user);
    ensure(!(await tx.get("account_suspensions", user.id)));
    const saved = await tx.get("sessions", found.id, true);
    const now = clock().toISOString();
    ensure(saved && !saved.revokedAt && saved.expiresAt > now);
    if (csrf !== undefined)
      ensure(digest(csrf) === saved.csrfHash, "FORBIDDEN");

    if (recent)
      ensure(
        Date.parse(saved.authenticatedAt) > Date.parse(now) - 10 * 60000,
        "FORBIDDEN"
      );

    return { user, saved };
  }

  return session;
}
