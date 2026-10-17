import { randomUUID } from "node:crypto";
import type { Repository, User } from "../model.js";
import { digest } from "../rules.js";
import type { createAuthIssueSession } from "./issueSession.js";
import type { createAuthNewUser } from "./newUser.js";
import type { createAuthSession } from "./session.js";
import { reserveEmail } from "./emailOwnership.js";
import { ensure, type ProviderProof } from "./shared.js";

/** Build completeOAuth behavior using the owning service dependencies. */
export function createAuthCompleteOAuth(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
  /** Shared service dependency. */ newUser: ReturnType<
    typeof createAuthNewUser
  >;
  /** Shared service dependency. */ clock: () => Date;
  /** Shared service dependency. */ issueSession: ReturnType<
    typeof createAuthIssueSession
  >;
}) {
  const { repository, session, newUser, clock, issueSession } = context;
  return {
    /** Commit stable provider identity; a verified Google email may initialize recovery without merging accounts. */
    async completeOAuth(
      stateId: string,
      browserSecret: string,
      proof: ProviderProof,
      token?: string
    ) {
      ensure(
        proof.subject.length > 0 && proof.subject.length <= 255,
        "VALIDATION"
      );

      return repository.transaction(async (tx) => {
        const found = await tx.get("oauth_states", stateId);
        ensure(found);
        let user: User | undefined;
        if (found.userId) {
          const context = await session(tx, token, undefined, true);
          ensure(context.user.id === found.userId, "FORBIDDEN");
          user = context.user;
        }

        const knownIdentity = (
          await tx.list("identities", {
            provider: proof.provider,
            subject: proof.subject,
          })
        )[0];

        const creating = !user && !knownIdentity;
        if (!user)
          user = knownIdentity
            ? await tx.get("users", knownIdentity.userId, true)
            : await newUser(tx, undefined, proof.avatar);

        ensure(user);
        await tx.serializeKey(`provider:${proof.provider}:${proof.subject}`);
        const saved = await tx.get("oauth_states", stateId, true);
        ensure(
          saved &&
            !saved.usedAt &&
            saved.expiresAt > clock().toISOString() &&
            saved.browserHash === digest(browserSecret) &&
            saved.provider === proof.provider
        );

        const identity = (
          await tx.list("identities", {
            provider: proof.provider,
            subject: proof.subject,
          })
        )[0];

        if (identity) {
          if (found.userId) ensure(identity.userId === user.id, "FORBIDDEN");
          else if (identity.userId !== user.id)
            throw Object.assign(new Error("Identity changed"), {
              code: "40001",
            });
        } else {
          user ??= await newUser(tx);
          ensure(
            !(
              await tx.list("identities", {
                userId: user.id,
                provider: proof.provider,
              })
            ).length,
            "FORBIDDEN"
          );

          await tx.insert("identities", {
            id: randomUUID(),
            userId: user.id,
            provider: proof.provider,
            subject: proof.subject,
          });
        }

        ensure(user);
        const profile = await tx.get("profiles", user.id, true);
        if (
          profile?.provisional &&
          proof.provider === "discord" &&
          proof.username
        ) {
          const candidate = proof.username
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 40);

          if (candidate.length >= 3) {
            await tx.serializeKey(`username:${candidate}`);
            if (
              !(await tx.list("profiles", { username: candidate })).some(
                (p) => p.id !== user.id
              )
            ) {
              profile.username = candidate;
              profile.provisional = false;
              await tx.save("profiles", profile);
            }
          }
        }

        if (
          creating &&
          profile &&
          proof.provider === "google" &&
          proof.recoveryEmail
        ) {
          // A conflicting address never links identities or overwrites another owner's recovery.
          try {
            await reserveEmail(tx, proof.recoveryEmail, user.id);
            profile.recoveryEmail = proof.recoveryEmail;
            await tx.save("profiles", profile);
          } catch (error) {
            if (
              !(error instanceof Error) ||
              !("code" in error) ||
              error.code !== "VALIDATION"
            )
              throw error;
          }
        }

        saved.usedAt = clock().toISOString();
        await tx.save("oauth_states", saved);
        return issueSession(tx, user.id);
      });
    },
  };
}
