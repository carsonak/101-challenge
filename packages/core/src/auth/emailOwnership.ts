import type { Transaction } from "../model.js";
import { ensure } from "./shared.js";

/** Resolve verified address owners; ambiguous legacy recovery addresses never authenticate. */
export async function emailOwners(tx: Transaction, email: string) {
  const owners = new Set(
    (await tx.list("profiles", { recoveryEmail: email })).map((p) => p.id)
  );

  for (const c of await tx.list("credentials", { email, verified: true })) {
    const profile = await tx.get("profiles", c.userId);
    if (!profile?.recoveryEmail || profile.recoveryEmail === email)
      owners.add(c.userId);
  }

  return [...owners];
}

/** Reserve a normalized email alias; call after locking the account and before saving proof. */
export async function reserveEmail(
  tx: Transaction,
  email: string,
  userId: string
) {
  await tx.serializeKey(`email:${email}`);
  ensure(
    !(await emailOwners(tx, email)).some((id) => id !== userId),
    "VALIDATION"
  );

  ensure(
    !(await tx.list("credentials", { email })).some((c) => c.userId !== userId),
    "VALIDATION"
  );
}
