import { randomUUID } from "node:crypto";
import type { Credential, Transaction } from "../model.js";
import { digest } from "../rules.js";
import type { AuthMail } from "./shared.js";

/** Build mailToken behavior using the owning service dependencies. */
export function createAuthMailToken(context: {
  /** Shared service dependency. */ opaque: () => string;
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { opaque, clock } = context;
  /** Persist a one-use proof hash and return plaintext only to the delivery port. */
  async function mailToken(
    tx: Transaction,
    credential: Credential,
    kind: "verify" | "recover"
  ): Promise<AuthMail> {
    const token = opaque();
    const now = clock().getTime();
    await tx.insert("auth_tokens", {
      id: randomUUID(),
      userId: credential.userId,
      kind,
      tokenHash: digest(token),
      expiresAt: new Date(
        now + (kind === "verify" ? 86400000 : 3600000)
      ).toISOString(),
      usedAt: null,
    });

    return { recipient: credential.email, kind, token };
  }

  return mailToken;
}
