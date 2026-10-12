import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createCapacity } from "../capacity.js";
import { DomainError } from "../tracker.js";

/** RFC 9106's 64 MiB Argon2id profile; versioned so verification never guesses parameters. */
export const argonParameters = {
  memory: 65536,
  passes: 3,
  parallelism: 4,
  tagLength: 32,
};

/** Native asynchronous Argon2 keeps expensive hashing off the request event loop. */
export const nativeDerive = promisify(argon2);

// Two 64 MiB hashes reserve about 128 MiB; keep the waiting queue small on a budget host.
/** One process-wide gate covers hashing, dummy verification and reauthentication. */
const passwordCapacity = createCapacity();

/** Acquire capacity for native password work. */
export const derive: typeof nativeDerive = (...args) =>
  passwordCapacity.run(() => nativeDerive(...args));

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
export function ensure(
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
