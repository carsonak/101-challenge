import type { Transaction } from "../model.js";

/** Invalidate outstanding credential proofs under the caller's account lock before replacing or removing credentials. */
export async function invalidateCredentialProofs(
  tx: Transaction,
  userId: string,
  now: string
) {
  for (const proof of await tx.list("auth_tokens", { userId })) {
    if (
      !proof.usedAt &&
      (proof.kind === "verify" || proof.kind === "recover")
    ) {
      proof.usedAt = now;
      await tx.save("auth_tokens", proof);
    }
  }
}
