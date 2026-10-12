import { randomUUID } from "node:crypto";
import type { Session, Transaction } from "../model.js";
import { digest } from "../rules.js";
import { ensure } from "./shared.js";

/** Build issueSession behavior using the owning service dependencies. */
export function createAuthIssueSession(context: {
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ opaque: () => string;
}) {
  const { clock, opaque } = context;
  /** Create a fresh opaque session after a successful independent proof. */
  async function issueSession(
    tx: Transaction,
    userId: string,
    device = "Unknown browser"
  ) {
    const deletion = (
      await tx.list("erasure_requests", { userId, processedAt: null })
    ).find((r) => !r.cancelledAt);

    ensure(!deletion || (deletion.deleteAfter ?? "") > clock().toISOString());
    const token = opaque(),
      csrf = opaque(),
      now = clock().toISOString();

    const saved: Session = {
      id: randomUUID(),
      userId,
      device,
      tokenHash: digest(token),
      csrfHash: digest(csrf),
      authenticatedAt: now,
      expiresAt: new Date(Date.parse(now) + 30 * 86400000).toISOString(),
      revokedAt: null,
    };

    await tx.insert("sessions", saved);
    return { token, csrf, expiresAt: saved.expiresAt };
  }

  return issueSession;
}
