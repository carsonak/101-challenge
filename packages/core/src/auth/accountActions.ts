import type { Credential } from "../model.js";
import type { AuthCommand } from "@challenge/contracts";
import { randomUUID } from "node:crypto";
import type { Transaction } from "../model.js";
import { digest } from "../rules.js";
import type { ActionContext, Delivery } from "./action-context.js";
import { ensure, verifyPassword } from "./shared.js";
/** Execute accountActions actions inside the caller's transaction. */
export function createAuthAccountActions(context: ActionContext) {
  const { clock, opaque, session, issueSession, mailToken, revokeSessions } =
    context;

  return async function accountActions(
    tx: Transaction,
    c: AuthCommand,
    computedHash: string | undefined,
    mayMail: boolean,
    device: string,
    deliveryState: Delivery,
    token?: string,
    csrf?: string
  ) {
    ensure(
      c.action !== "signup" &&
        c.action !== "recover" &&
        c.action !== "login" &&
        c.action !== "verify_recovery_email" &&
        c.action !== "verify" &&
        c.action !== "reset",
      "VALIDATION"
    );

    ensure(csrf, "FORBIDDEN");
    const context = await session(
      tx,
      token,
      csrf,
      ["add_email", "unlink", "request_erasure", "recovery_email"].includes(
        c.action
      )
    );

    const { user, saved } = context;
    const deletion = (
      await tx.list("erasure_requests", {
        userId: user.id,
        processedAt: null,
      })
    ).find((r) => !r.cancelledAt);

    ensure(
      !deletion || ["restore_account", "logout"].includes(c.action),
      "FORBIDDEN"
    );

    if (c.action === "restore_account") {
      ensure(
        deletion && (deletion.deleteAfter ?? "") > clock().toISOString(),
        "FORBIDDEN"
      );

      deletion.cancelledAt = clock().toISOString();
      await tx.save("erasure_requests", deletion);
      await revokeSessions(tx, user.id);
      return {
        accepted: true,
        ...(await issueSession(tx, user.id, device)),
      };
    }

    if (
      c.action === "save_profile" ||
      c.action === "set_avatar" ||
      c.action === "recovery_email"
    ) {
      const profile = await tx.get("profiles", user.id, true);
      ensure(profile);
      if (c.action === "save_profile") {
        await tx.serializeKey(`username:${c.username}`);
        ensure(
          !(await tx.list("profiles", { username: c.username })).some(
            (p) => p.id !== user.id
          ),
          "VALIDATION"
        );

        profile.username = c.username;
        profile.provisional = false;
      }

      if (c.action === "set_avatar") {
        ensure(
          c.avatar === null ||
            /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(c.avatar),
          "VALIDATION"
        );

        profile.avatar = c.avatar;
      }

      if (c.action === "recovery_email") {
        if (!mayMail) return { accepted: true };

        for (const t of await tx.list("auth_tokens", {
          userId: user.id,
          kind: "recovery_email",
        })) {
          t.usedAt = clock().toISOString();
          await tx.save("auth_tokens", t);
        }

        profile.pendingEmail = c.email;
        const proof = opaque();
        await tx.insert("auth_tokens", {
          id: randomUUID(),
          userId: user.id,
          kind: "recovery_email",
          tokenHash: digest(proof),
          usedAt: null,
          expiresAt: new Date(clock().getTime() + 86400000).toISOString(),
        });

        deliveryState.mail = {
          recipient: c.email,
          kind: "recovery_email",
          token: proof,
        };
      }

      await tx.save("profiles", profile);
      return { accepted: true };
    }

    if (c.action === "revoke_session") {
      const other = await tx.get("sessions", c.sessionId, true);
      ensure(other?.userId === user.id, "NOT_FOUND");
      other.revokedAt = clock().toISOString();
      await tx.save("sessions", other);
      return { accepted: true };
    }

    if (c.action === "notification") {
      const notice = await tx.get("notifications", c.id, true);
      ensure(notice?.userId === user.id, "NOT_FOUND");
      notice.readAt = clock().toISOString();
      if (c.dismiss) notice.dismissedAt = clock().toISOString();

      await tx.save("notifications", notice);
      return { accepted: true };
    }

    if (c.action === "logout") {
      saved.revokedAt = clock().toISOString();
      await tx.save("sessions", saved);
      return { accepted: true };
    }

    if (c.action === "reauthenticate") {
      const credential = await tx.get("credentials", user.id);
      ensure(
        credential?.verified &&
          (await verifyPassword(c.password, credential.passwordHash))
      );

      saved.authenticatedAt = clock().toISOString();
      await tx.save("sessions", saved);
      return { accepted: true };
    }

    if (c.action === "add_email") {
      await tx.serializeKey(`email:${c.email}`);
      const old = await tx.get("credentials", user.id);
      ensure(!old, "FORBIDDEN");
      ensure(
        !(await tx.list("credentials", { email: c.email })).length,
        "FORBIDDEN"
      );

      ensure(computedHash, "VALIDATION");
      const credential: Credential = {
        id: user.id,
        userId: user.id,
        email: c.email,
        passwordHash: computedHash,
        verified: false,
      };

      await tx.insert("credentials", credential);
      if (mayMail)
        deliveryState.mail = await mailToken(tx, credential, "verify");

      return { accepted: true };
    }

    if (c.action === "unlink") {
      const credential = await tx.get("credentials", user.id);
      const identities = await tx.list("identities", { userId: user.id });
      const usable = Number(credential?.verified ?? false) + identities.length;
      const removedUsable =
        c.provider === "email"
          ? Number(credential?.verified ?? false)
          : Number(identities.some((i) => i.provider === c.provider));

      ensure(usable - removedUsable >= 1, "FORBIDDEN");
      if (c.provider === "email") {
        ensure(credential, "NOT_FOUND");
        await tx.remove("credentials", credential.id);
      } else {
        const identity = identities.find((i) => i.provider === c.provider);
        ensure(identity, "NOT_FOUND");
        await tx.remove("identities", identity.id);
      }

      await revokeSessions(tx, user.id);
      return { accepted: true };
    }

    const profile = await tx.get("profiles", user.id, true);
    ensure(
      c.action === "request_erasure" &&
        profile?.username === c.username &&
        profile.recoveryEmail,
      "VALIDATION"
    );

    const requestId = randomUUID();
    await tx.insert("erasure_requests", {
      id: requestId,
      userId: user.id,
      requestedAt: clock().toISOString(),
      deleteAfter: new Date(clock().getTime() + 7 * 86400000).toISOString(),
      cancelledAt: null,
      processedAt: null,
    });

    await tx.insert("account_mail", {
      id: randomUUID(),
      userId: user.id,
      requestId,
      sentAt: null,
      nextAttemptAt: clock().toISOString(),
      failures: 0,
    });

    await revokeSessions(tx, user.id);
    return { accepted: true, requestId };
  };
}
