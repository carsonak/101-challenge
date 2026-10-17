import type { AuthCommand } from "@challenge/contracts";
import type { Transaction } from "../model.js";
import { digest } from "../rules.js";
import type { ActionContext, Delivery } from "./action-context.js";
import { invalidateCredentialProofs } from "./credentialProofs.js";
import { ensure, hashPassword, verifyPassword } from "./shared.js";
/** Execute anonymous actions inside the caller's transaction. */
export function createAuthAnonymous(context: ActionContext) {
  const {
    clock,
    opaque,
    issueSession,
    newUser,
    mailToken,
    revokeSessions,
    dummyState,
  } = context;

  return async function anonymous(
    tx: Transaction,
    c: AuthCommand,
    computedHash: string | undefined,
    mayMail: boolean,
    device: string,
    deliveryState: Delivery,
    _token?: string,
    _csrf?: string
  ) {
    if (
      c.action === "signup" ||
      c.action === "recover" ||
      c.action === "resend_verification"
    ) {
      await tx.serializeKey(`email:${c.email}`);
      let credential = (await tx.list("credentials", { email: c.email }))[0];
      if (c.action === "signup" && !credential) {
        const user = await newUser(tx, c.username);
        ensure(computedHash, "VALIDATION");
        credential = {
          id: user.id,
          userId: user.id,
          email: c.email,
          passwordHash: computedHash,
          verified: false,
        };

        await tx.insert("credentials", credential);
      }

      if (credential) {
        ensure(await tx.get("users", credential.userId, true));
        credential = await tx.get("credentials", credential.id, true);
        if (credential?.email !== c.email) credential = undefined;
      }

      if (
        mayMail &&
        credential &&
        (c.action === "recover" || !credential.verified)
      )
        deliveryState.mail = await mailToken(
          tx,
          credential,
          c.action === "recover" ? "recover" : "verify"
        );

      return { accepted: true };
    }

    if (c.action === "login") {
      const found = (await tx.list("credentials", { email: c.email }))[0];
      dummyState.current ??= hashPassword(opaque()).catch((error) => {
        dummyState.current = undefined;
        throw error;
      });

      const valid = await verifyPassword(
        c.password,
        found?.passwordHash ?? (await dummyState.current)
      );

      ensure(found && valid && found.verified);
      const user = await tx.get("users", found.userId, true);
      ensure(user);
      const credential = await tx.get("credentials", found.id, true);
      ensure(
        credential?.verified && credential.passwordHash === found.passwordHash
      );

      return {
        accepted: true,
        ...(await issueSession(tx, user.id, device)),
      };
    }

    if (c.action === "verify_recovery_email") {
      const found = (
        await tx.list("auth_tokens", {
          tokenHash: digest(c.token),
          kind: "recovery_email",
        })
      )[0];

      ensure(found);
      ensure(await tx.get("users", found.userId, true));
      const proof = await tx.get("auth_tokens", found.id, true);
      ensure(proof && !proof.usedAt && proof.expiresAt > clock().toISOString());
      const profile = await tx.get("profiles", found.userId, true);
      ensure(profile?.pendingEmail);
      profile.recoveryEmail = profile.pendingEmail;
      profile.pendingEmail = null;
      proof.usedAt = clock().toISOString();
      await tx.save("profiles", profile);
      await tx.save("auth_tokens", proof);
      return { accepted: true };
    }

    if (c.action === "verify" || c.action === "reset") {
      const found = (
        await tx.list("auth_tokens", { tokenHash: digest(c.token) })
      )[0];

      ensure(
        found && found.kind === (c.action === "verify" ? "verify" : "recover")
      );

      const user = await tx.get("users", found.userId, true);
      ensure(user);
      const proof = await tx.get("auth_tokens", found.id, true);
      const now = clock().toISOString();
      ensure(proof && !proof.usedAt && proof.expiresAt > now);
      const credential = await tx.get("credentials", user.id, true);
      ensure(credential);
      if (c.action === "verify") credential.verified = true;
      else {
        ensure(computedHash, "VALIDATION");
        await invalidateCredentialProofs(tx, user.id, now);
        credential.passwordHash = computedHash;
        credential.verified = true;
        await revokeSessions(tx, user.id);
      }

      proof.usedAt = now;
      await tx.save("auth_tokens", proof);
      await tx.save("credentials", credential);
      const profile = await tx.get("profiles", user.id, true);
      if (profile && !profile.recoveryEmail) {
        profile.recoveryEmail = credential.email;
        await tx.save("profiles", profile);
      }

      return { accepted: true };
    }
  };
}
