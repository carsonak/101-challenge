import type { AuthCommand } from "@challenge/contracts";
import type { Transaction, Credential } from "../model.js";
import type { ActionContext, Delivery } from "./action-context.js";
import { invalidateCredentialProofs } from "./credentialProofs.js";
import { reserveEmail } from "./emailOwnership.js";
import { ensure } from "./shared.js";

/** Change credential ownership only after the caller locks and recently authenticates the account; revoke sessions and stale proofs on removal/replacement. */
export async function credentialAction(
  tx: Transaction,
  c: AuthCommand,
  userId: string,
  computedHash: string | undefined,
  mayMail: boolean,
  delivery: Delivery,
  {
    clock,
    mailToken,
    revokeSessions,
  }: Pick<ActionContext, "clock" | "mailToken" | "revokeSessions">
) {
  if (c.action === "change_password") {
    let credential = await tx.get("credentials", userId, true);
    ensure(computedHash, "VALIDATION");
    if (!credential) {
      credential = {
        id: userId,
        userId,
        email: null,
        verified: false,
        passwordHash: computedHash,
      };

      await tx.insert("credentials", credential);
    }

    await invalidateCredentialProofs(tx, userId, clock().toISOString());
    credential.passwordHash = computedHash;
    await tx.save("credentials", credential);
    await revokeSessions(tx, userId);
    return { accepted: true };
  }

  if (c.action === "add_email") {
    await reserveEmail(tx, c.email, userId);
    ensure(!(await tx.get("credentials", userId)), "FORBIDDEN");
    ensure(
      !(await tx.list("credentials", { email: c.email })).length,
      "FORBIDDEN"
    );

    ensure(computedHash, "VALIDATION");
    await invalidateCredentialProofs(tx, userId, clock().toISOString());
    const credential: Credential = {
      id: userId,
      userId,
      email: c.email,
      passwordHash: computedHash,
      verified: false,
    };

    await tx.insert("credentials", credential);
    if (mayMail)
      delivery.mail = await mailToken(
        tx,
        { ...credential, email: c.email },
        "verify"
      );

    return { accepted: true };
  }

  if (c.action === "unlink") {
    const credential = await tx.get("credentials", userId);
    const identities = await tx.list("identities", { userId });
    const usable = Number(Boolean(credential)) + identities.length;
    const removed =
      c.provider === "email"
        ? Number(Boolean(credential))
        : Number(identities.some((i) => i.provider === c.provider));

    ensure(usable - removed >= 1, "FORBIDDEN");
    if (c.provider === "email") {
      ensure(credential, "NOT_FOUND");
      await invalidateCredentialProofs(tx, userId, clock().toISOString());
      await tx.remove("credentials", credential.id);
    } else {
      const identity = identities.find((i) => i.provider === c.provider);
      ensure(identity, "NOT_FOUND");
      await tx.remove("identities", identity.id);
    }

    await revokeSessions(tx, userId);
    return { accepted: true };
  }
}
