import { createHmac, timingSafeEqual } from "node:crypto";

/** A wake signature authorizes only an empty scan of one service, never a job or account operation. */
export function signWake(
  secret: string,
  service: "worker" | "maintenance",
  timestamp: string
) {
  return createHmac("sha256", secret)
    .update(`POST\n/wake\n${service}\n${timestamp}`)
    .digest("hex");
}

/** Verify a bounded, recent wake request without I/O; service keys must be distinct. */
export function verifyWake(
  secret: string | undefined,
  service: "worker" | "maintenance",
  timestamp: string | undefined,
  signature: string | undefined,
  now = Date.now()
) {
  if (
    !secret ||
    !timestamp ||
    !/^\d{13}$/.test(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(now - Number(timestamp)) > 60000
  )
    return false;

  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(signWake(secret, service, timestamp), "hex")
  );
}
