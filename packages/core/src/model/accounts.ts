import type { Row } from "./common.js";

/** Private email credential; ID equals user ID and address uniqueness is database-enforced. */
export interface Credential extends Row {
  /** Account owning this independently verified sign-in method. */
  userId: string;
  /** Normalized private delivery/sign-in address. */
  email: string;
  /** Versioned salted Argon2id hash; never transport this field. */
  passwordHash: string;
  /** Verification proof is required before password login. */
  verified: boolean;
}

/** Provider identity ownership is unique by provider and stable subject, never by email. */
export interface Identity extends Row {
  /** Owning independent account. */
  userId: string;
  /** Provider issuing the subject identifier. */
  provider: "google" | "discord";
  /** Opaque stable provider subject; Discord snowflakes remain strings. */
  subject: string;
}

/** Opaque hashed authentication session and bound CSRF proof. */
export interface Session extends Row {
  /** Coarse browser/device label; never the raw user-agent. */
  device?: string;
  /** Authenticated independent account. */
  userId: string;
  /** Hash of the opaque HttpOnly session cookie. */
  tokenHash: string;
  /** Hash of the CSRF secret returned to the authenticated browser. */
  csrfHash: string;
  /** Last successful authentication instant for sensitive operations. */
  authenticatedAt: string;
  /** Absolute session expiry instant. */
  expiresAt: string;
  /** Explicit logout/recovery/unlink revocation instant. */
  revokedAt: string | null;
}

/** One-use verification or recovery proof, hashed at rest and bound to its account. */
export interface AuthToken extends Row {
  /** Account receiving proof through its private delivery address. */
  userId: string;
  /** Verification and password recovery cannot redeem each other's keys. */
  kind: "verify" | "recover" | "recovery_email";
  /** Opaque key hash; plaintext exists only during delivery. */
  tokenHash: string;
  /** Absolute expiry; redemption checks time while locked. */
  expiresAt: string;
  /** Atomic redemption marker. */
  usedAt: string | null;
}

/** Browser-bound one-use OAuth authorization state; private and short-lived. */
export interface OAuthState extends Row {
  /** Provider selected when authorization began. */
  provider: "google" | "discord";
  /** Linking target; null means an independent login/signup. */
  userId: string | null;
  /** Hash of browser-visible state. */
  stateHash: string;
  /** Hash of the separate HttpOnly browser binding secret. */
  browserHash: string;
  /** Nonce sent to Google and required in its verified ID token. */
  nonce: string;
  /** Short-lived PKCE verifier for providers supporting it. */
  verifier: string;
  /** Expiring authorization proof. */
  expiresAt: string;
  /** Callback replay marker. */
  usedAt: string | null;
}

/** Owner-confirmed account deletion request; execution is a separate privileged path. */
export interface ErasureRequest extends Row {
  /** Fixed erasure deadline, checked under the account lock. */
  deleteAfter?: string;
  /** Owner recovery timestamp; cancelled requests cannot execute. */
  cancelledAt?: string | null;
  /** Account to erase, established from a recent authenticated session. */
  userId: string;
  /** Time of explicit owner confirmation. */
  requestedAt: string;
  /** Privileged completion timestamp, null until processed. */
  processedAt: string | null;
}

/** Owner profile; provider identity claims never establish email ownership. */
export interface Profile extends Row {
  /** Unique normalized username. */
  username: string;
  /** Existing/provisioned accounts must confirm their suggested username. */
  provisional: boolean;
  /** Sanitized image data or trusted provider image URL. */
  avatar: string | null;
  /** Verified independently, including for provider-only accounts. */
  recoveryEmail: string | null;
  /** Pending verification target; changing it invalidates old proofs. */
  pendingEmail: string | null;
}

/** Content-free owner notification; no private log text. */
export interface Notification extends Row {
  /** Owning account. */
  userId: string;
  /** Human-readable event summary without participant text. */
  message: string;
  /** Server-owned relative navigation target. */
  href: string;
  /** Creation instant. */
  createdAt: string;
  /** Read marker. */
  readAt: string | null;
  /** Dismissal marker. */
  dismissedAt: string | null;
}

/** Retryable deletion notice; recovery uses independent sign-in proof, never a queued bearer secret. */
export interface AccountMail extends Row {
  /** Owning account; cascade deleted on erasure. */
  userId: string;
  /** Request to describe; cancelled notices are discarded. */
  requestId: string;
  /** Successful delivery marker. */
  sentAt: string | null;
  /** Retry backoff boundary. */
  nextAttemptAt: string;
  /** Number of failed delivery attempts. */
  failures: number;
}
