import { argon2, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  authCommandSchema,
  accountSchema,
  type AuthCommand,
} from "@challenge/contracts";
import type {
  Repository,
  Transaction,
  Session,
  User,
  Credential,
  OAuthState,
} from "./model.js";
import { digest } from "./rules.js";
import { DomainError } from "./tracker.js";

/** RFC 9106's 64 MiB Argon2id profile; versioned so verification never guesses parameters. */
const argonParameters = {
  memory: 65536,
  passes: 3,
  parallelism: 4,
  tagLength: 32,
};
/** Native asynchronous Argon2 keeps expensive hashing off the request event loop. */
const derive = promisify(argon2);
/** Hash passwords with fresh 16-byte salts; returned versioned record stays private. */
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const key = await derive("argon2id", {
    ...argonParameters,
    message: password,
    nonce,
  });
  return `argon2id-v1:${nonce.toString("hex")}:${key.toString("hex")}`;
}
/** Verify a private versioned hash in constant time; malformed hashes fail closed. */
export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  const [version, salt, expected] = encoded.split(":");
  if (
    version !== "argon2id-v1" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{64}$/.test(expected ?? "")
  )
    return false;
  const key = await derive("argon2id", {
    ...argonParameters,
    message: password,
    nonce: Buffer.from(salt ?? "", "hex"),
  });
  return timingSafeEqual(key, Buffer.from(expected ?? "", "hex"));
}
/** Reject authentication without exposing addresses, tokens or supplied values. */
function ensure(
  value: unknown,
  code:
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "VALIDATION"
    | "NOT_FOUND" = "UNAUTHENTICATED"
): asserts value {
  if (!value) throw new DomainError(code);
}
/** Mail delivery port; tokens are plaintext only in the owner-directed delivery. */
export interface AuthMail {
  /** Private recipient that must never enter logs or public responses. */
  recipient: string;
  /** Owner action encoded by the one-use key. */
  kind: "verify" | "recover" | "recovery_email" | "deletion";
  /** Opaque key included in a private verification/recovery link. */
  token: string;
}
/** Identity proof returned by a verified provider transport, not by client JSON. */
export interface ProviderProof {
  /** Provider that validated the proof. */
  provider: "google" | "discord";
  /** Stable verified subject; matching email never establishes ownership. */
  subject: string;
  /** Optional provider-owned profile defaults; never identity proof. */
  username?: string;
  /** HTTPS picture from a trusted provider host. */
  avatar?: string;
}
/** Authentication dependencies are injected for local mail and OAuth doubles. */
export interface AuthOptions {
  /** Deliver private one-use keys after database commit; never log messages. */
  sendMail: (mail: AuthMail) => Promise<void>;
  /** Clock for expiry and recent authentication. */
  now?: () => Date;
}
/** Independent account authentication, hashed sessions, recovery and explicit linking. */
export function createAuth(repository: Repository, options: AuthOptions) {
  const clock = options.now ?? (() => new Date());
  const opaque = () => randomBytes(32).toString("hex");
  let dummyHash: Promise<string> | undefined;
  /** Find and lock the authenticated user before session/resource locks. */
  async function session(
    tx: Transaction,
    raw: string | undefined,
    csrf?: string,
    recent = false
  ) {
    ensure(raw && /^[a-f0-9]{64}$/.test(raw));
    const found = (await tx.list("sessions", { tokenHash: digest(raw) }))[0];
    ensure(found);
    const user = await tx.get("users", found.userId, true);
    ensure(user);
    const saved = await tx.get("sessions", found.id, true);
    const now = clock().toISOString();
    ensure(saved && !saved.revokedAt && saved.expiresAt > now);
    if (csrf !== undefined)
      ensure(digest(csrf) === saved.csrfHash, "FORBIDDEN");
    if (recent)
      ensure(
        Date.parse(saved.authenticatedAt) > Date.parse(now) - 10 * 60000,
        "FORBIDDEN"
      );
    return { user, saved };
  }
  /** Create a fresh opaque session after a successful independent proof. */
  async function issueSession(
    tx: Transaction,
    userId: string,
    device = "Unknown browser"
  ) {
    const deletion = (
      await tx.list("erasure_requests", { userId, processedAt: null })
    ).find((r) => !r.cancelledAt);
    ensure(!deletion || (deletion.deleteAfter ?? "") > clock().toISOString());
    const token = opaque(),
      csrf = opaque(),
      now = clock().toISOString();
    const saved: Session = {
      id: randomUUID(),
      userId,
      device,
      tokenHash: digest(token),
      csrfHash: digest(csrf),
      authenticatedAt: now,
      expiresAt: new Date(Date.parse(now) + 30 * 86400000).toISOString(),
      revokedAt: null,
    };
    await tx.insert("sessions", saved);
    return { token, csrf, expiresAt: saved.expiresAt };
  }
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
  /** Revoke all sessions after recovery or a sensitive credential change. */
  async function revokeSessions(tx: Transaction, userId: string) {
    for (const row of await tx.list("sessions", { userId })) {
      row.revokedAt = clock().toISOString();
      await tx.save("sessions", row);
    }
  }
  return {
    /** Authorize a browser session; optionally verify CSRF/recent proof before mutations. */
    async authenticate(token?: string, csrf?: string, recent = false) {
      return repository.transaction(async (tx) => {
        const { user, saved } = await session(tx, token, csrf, recent);
        ensure(
          !(
            await tx.list("erasure_requests", {
              userId: user.id,
              processedAt: null,
            })
          ).some((r) => !r.cancelledAt),
          "FORBIDDEN"
        );
        return { userId: user.id, admin: user.admin, sessionId: saved.id };
      });
    },
    /** Return account settings with no secret credential/provider/session fields. */
    async account(token?: string) {
      return repository.transaction(async (tx) => {
        const { user } = await session(tx, token);
        const credential = await tx.get("credentials", user.id);
        const identities = await tx.list("identities", { userId: user.id });
        const profile = await tx.get("profiles", user.id);
        ensure(profile);
        const deletion = (
          await tx.list("erasure_requests", {
            userId: user.id,
            processedAt: null,
          })
        ).find((r) => !r.cancelledAt);
        return accountSchema.parse({
          username: profile.username,
          provisional: profile.provisional,
          avatar: profile.avatar,
          recoveryEmail: profile.recoveryEmail,
          deletion: deletion
            ? {
                requestedAt: deletion.requestedAt,
                deleteAfter: deletion.deleteAfter,
              }
            : null,
          id: user.id,
          email: credential?.email ?? null,
          emailVerified: credential?.verified ?? false,
          providers: identities.map((i) => i.provider),
          admin: user.admin,
        });
      });
    },
    /** Execute validated email/account commands; private mail delivery occurs after commit. */
    async execute(
      input: unknown,
      token?: string,
      csrf?: string,
      device = "Unknown browser"
    ) {
      const parsed = authCommandSchema.safeParse(input);
      ensure(parsed.success, "VALIDATION");
      const c: AuthCommand = parsed.data;
      const computedHash =
        c.action === "signup" ||
        c.action === "reset" ||
        c.action === "add_email"
          ? await hashPassword(c.password)
          : undefined;
      let delivery: AuthMail | undefined;
      const result = await repository.transaction(async (tx) => {
        if (c.action === "signup" || c.action === "recover") {
          await tx.serializeKey(`email:${c.email}`);
          let credential = (
            await tx.list("credentials", { email: c.email })
          )[0];
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
          if (credential && (c.action === "recover" || !credential.verified))
            delivery = await mailToken(
              tx,
              credential,
              c.action === "recover" ? "recover" : "verify"
            );
          return { accepted: true };
        }
        if (c.action === "login") {
          const found = (await tx.list("credentials", { email: c.email }))[0];
          dummyHash ??= hashPassword(opaque());
          const valid = await verifyPassword(
            c.password,
            found?.passwordHash ?? (await dummyHash)
          );
          ensure(found && valid && found.verified);
          const user = await tx.get("users", found.userId, true);
          ensure(user);
          const credential = await tx.get("credentials", found.id, true);
          ensure(
            credential?.verified &&
              credential.passwordHash === found.passwordHash
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
          ensure(
            proof && !proof.usedAt && proof.expiresAt > clock().toISOString()
          );
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
            found &&
              found.kind === (c.action === "verify" ? "verify" : "recover")
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
            delivery = {
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
          delivery = await mailToken(tx, credential, "verify");
          return { accepted: true };
        }
        if (c.action === "unlink") {
          const credential = await tx.get("credentials", user.id);
          const identities = await tx.list("identities", { userId: user.id });
          const usable =
            Number(credential?.verified ?? false) + identities.length;
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
      });
      if (delivery) {
        try {
          await options.sendMail(delivery);
        } catch {
          /* Enumeration-safe: owner may request another private delivery. */
        }
      }
      return result;
    },
    /** Owner-only session history with coarse device labels and no bearer secrets. */
    async sessions(token?: string) {
      return repository.transaction(async (tx) => {
        const { user, saved } = await session(tx, token);
        return (await tx.list("sessions", { userId: user.id })).map((s) => ({
          id: s.id,
          device: s.device ?? "Unknown browser",
          authenticatedAt: s.authenticatedAt,
          expiresAt: s.expiresAt,
          revokedAt: s.revokedAt,
          current: s.id === saved.id,
        }));
      });
    },
    /** Owner-only inbox; dismissed notifications are excluded. */
    async notifications(token?: string) {
      return repository.transaction(async (tx) => {
        const { user } = await session(tx, token);
        return (
          await tx.list("notifications", { userId: user.id, dismissedAt: null })
        ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
    /** Begin browser-bound OAuth proof; a linking target needs recent authenticated CSRF proof. */
    async beginOAuth(
      provider: "google" | "discord",
      browserSecret: string,
      token?: string,
      csrf?: string,
      link = false
    ) {
      const state = opaque(),
        nonce = opaque(),
        verifier = randomBytes(32).toString("base64url");
      await repository.transaction(async (tx) => {
        if (link) ensure(csrf, "FORBIDDEN");
        const userId = link
          ? (await session(tx, token, csrf, true)).user.id
          : null;
        await tx.insert("oauth_states", {
          id: randomUUID(),
          provider,
          userId,
          stateHash: digest(state),
          browserHash: digest(browserSecret),
          nonce,
          verifier,
          expiresAt: new Date(clock().getTime() + 10 * 60000).toISOString(),
          usedAt: null,
        });
      });
      return { state, nonce, verifier };
    },
    /** Read a short-lived callback state for a provider transport; does not consume it yet. */
    async oauthState(
      provider: "google" | "discord",
      state: string,
      browserSecret: string
    ): Promise<OAuthState> {
      return repository.transaction(async (tx) => {
        const saved = (
          await tx.list("oauth_states", { stateHash: digest(state) })
        )[0];
        ensure(
          saved &&
            saved.provider === provider &&
            saved.browserHash === digest(browserSecret) &&
            !saved.usedAt &&
            saved.expiresAt > clock().toISOString()
        );
        return saved;
      });
    },
    /** Commit verified provider ownership; email claims are deliberately ignored. */
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
        if (profile?.provisional && proof.username) {
          const candidate = proof.username
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 32);
          if (candidate.length >= 3) {
            await tx.serializeKey(`username:${candidate}`);
            if (
              !(await tx.list("profiles", { username: candidate })).some(
                (p) => p.id !== user.id
              )
            ) {
              profile.username = candidate;
              await tx.save("profiles", profile);
            }
          }
        }
        saved.usedAt = clock().toISOString();
        await tx.save("oauth_states", saved);
        return issueSession(tx, user.id);
      });
    },
    /** Map signed guild actors solely through a linked Discord subject. */
    async discordActor(subject: string) {
      return repository.transaction(
        async (tx) =>
          (await tx.list("identities", { provider: "discord", subject }))[0]
            ?.userId
      );
    },
  };
}
