import type { AuthCommand } from "@challenge/contracts";
import type { Transaction } from "../model.js";
import { digest } from "../rules.js";
import type { ActionContext, Delivery } from "./action-context.js";
import { invalidateCredentialProofs } from "./credentialProofs.js";
import { signup } from "./signup.js";
import { emailOwners, reserveEmail } from "./emailOwnership.js";
import { ensure, hashPassword, verifyPassword } from "./shared.js";
/** Execute anonymous actions inside the caller's transaction. */
export function createAuthAnonymous(context: ActionContext) {
  const { clock, opaque, issueSession, mailToken, revokeSessions, dummyState } =
    context;

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
    if (c.action === "signup")
      return signup(tx, c, computedHash, mayMail, deliveryState, context);

    if (c.action === "recover" || c.action === "resend_verification") {
      await tx.serializeKey(`email:${c.email}`);
      if (c.action === "recover") {
        const owners = await emailOwners(tx, c.email);
        if (owners.length === 1) {
          const userId = owners[0];
          ensure(userId);
          ensure(await tx.get("users", userId, true));
          if (mayMail && (await emailOwners(tx, c.email)).join() === userId)
            deliveryState.mail = await mailToken(
              tx,
              { userId, email: c.email },
              "recover"
            );
        }
      } else {
        const credential = (
          await tx.list("credentials", { email: c.email })
        )[0];

        if (credential) {
          ensure(await tx.get("users", credential.userId, true));
          const current = await tx.get("credentials", credential.id, true);
          if (mayMail && current?.email === c.email && !current.verified)
            deliveryState.mail = await mailToken(
              tx,
              { ...current, email: c.email },
              "verify"
            );
        }
      }

      return { accepted: true };
    }

    if (c.action === "login") {
      const identifier =
        "identifier" in c
          ? c.identifier
          : "username" in c
            ? c.username
            : c.email;

      const ids = identifier.includes("@")
        ? await emailOwners(tx, identifier)
        : (await tx.list("profiles", { username: identifier })).map(
            (p) => p.id
          );

      const id = ids[0];
      const found =
        ids.length === 1 && id ? await tx.get("credentials", id) : undefined;

      dummyState.current ??= hashPassword(opaque()).catch((error) => {
        dummyState.current = undefined;
        throw error;
      });

      const valid = await verifyPassword(
        c.password,
        found?.passwordHash ?? (await dummyState.current)
      );

      ensure(found && valid);
      const user = await tx.get("users", found.userId, true);
      ensure(user);
      const credential = await tx.get("credentials", found.id, true);
      ensure(
        identifier.includes("@")
          ? (await emailOwners(tx, identifier)).join() === user.id
          : (await tx.get("profiles", user.id))?.username === identifier
      );

      ensure(credential && credential.passwordHash === found.passwordHash);

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
      await reserveEmail(tx, profile.pendingEmail, found.userId);
      await invalidateCredentialProofs(tx, found.userId, clock().toISOString());
      const credential = await tx.get("credentials", found.userId, true);
      if (credential) {
        credential.email = profile.pendingEmail;
        credential.verified = true;
        await tx.save("credentials", credential);
      }

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
      let credential = await tx.get("credentials", user.id, true);
      const profile = await tx.get("profiles", user.id, true);
      ensure(profile);
      if (c.action === "verify") {
        ensure(credential?.email);
        await reserveEmail(tx, credential.email, user.id);
        credential.verified = true;
        profile.recoveryEmail = credential.email;
        profile.pendingEmail = null;
      } else {
        ensure(computedHash && profile.recoveryEmail, "VALIDATION");
        credential ??= {
          id: user.id,
          userId: user.id,
          email: profile.recoveryEmail,
          verified: true,
          passwordHash: computedHash,
        };

        await invalidateCredentialProofs(tx, user.id, now);
        await reserveEmail(tx, profile.recoveryEmail, user.id);
        ensure(
          (await emailOwners(tx, profile.recoveryEmail)).join() === user.id
        );

        credential.passwordHash = computedHash;
        credential.email = profile.recoveryEmail;
        credential.verified = true;
        await revokeSessions(tx, user.id);
      }

      proof.usedAt = now;
      await tx.save("auth_tokens", proof);
      ensure(credential);
      if (await tx.get("credentials", user.id))
        await tx.save("credentials", credential);
      else await tx.insert("credentials", credential);

      await tx.save("profiles", profile);

      return { accepted: true };
    }
  };
}
