import type { AuthCommand } from "@challenge/contracts";
import type { Transaction } from "../model.js";
import type { ActionContext, Delivery } from "./action-context.js";
import { emailOwners } from "./emailOwnership.js";
import { ensure } from "./shared.js";

/** Create a username/password account; optional email remains untrusted until verified. */
export async function signup(
  tx: Transaction,
  c: Extract<AuthCommand, { action: "signup" }>,
  hash: string | undefined,
  mayMail: boolean,
  delivery: Delivery,
  context: ActionContext
) {
  if (c.email) {
    await tx.serializeKey(`email:${c.email}`);
    if (
      (await emailOwners(tx, c.email)).length ||
      (await tx.list("credentials", { email: c.email })).length
    )
      return { accepted: true };
  }

  const user = await context.newUser(tx, c.username);
  ensure(hash, "VALIDATION");
  const credential = {
    id: user.id,
    userId: user.id,
    email: c.email ?? null,
    passwordHash: hash,
    verified: false,
  };

  await tx.insert("credentials", credential);
  if (c.email && mayMail)
    delivery.mail = await context.mailToken(
      tx,
      { ...credential, email: c.email },
      "verify"
    );

  return { accepted: true };
}
