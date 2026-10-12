import { randomUUID } from "node:crypto";
import type { Transaction, User } from "../model.js";
import { ensure } from "./shared.js";

/** Build newUser behavior using the owning service dependencies. */
export function createAuthNewUser(context: {
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ opaque: () => string;
}) {
  const { clock, opaque } = context;
  /** Provision account identity inside the same transaction as its first usable proof. */
  async function newUser(
    tx: Transaction,
    username?: string,
    avatar?: string
  ): Promise<User> {
    const now = clock().toISOString();
    const row: User = {
      id: randomUUID(),
      participantSeed: opaque(),
      admin: false,
      createdAt: now,
      updatedAt: now,
    };

    await tx.insert("users", row);
    const handle =
      username ?? `user-${row.id.replaceAll("-", "").slice(0, 26)}`;

    await tx.serializeKey(`username:${handle}`);
    ensure(
      !(await tx.list("profiles", { username: handle })).length,
      "VALIDATION"
    );

    await tx.insert("profiles", {
      id: row.id,
      username: handle,
      provisional: !username,
      avatar: avatar ?? null,
      recoveryEmail: null,
      pendingEmail: null,
    });

    return row;
  }

  return newUser;
}
