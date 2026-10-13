/** Abuse-control port: production reservations are shared; fixture implementations may be synchronous. */
export interface Throttle {
  /** Consume a bounded bucket or throw RATE_LIMITED with retryAfter. */
  take(
    action: string,
    identity: string,
    limit: number,
    windowMs: number
  ): void | Promise<void>;
  /** Reserve enumeration-safe mail cooldowns; storage failures must reject. */
  allow(
    action: string,
    identity: string,
    windowMs: number
  ): boolean | Promise<boolean>;
}

import { createHmac, randomBytes } from "node:crypto";
import { DomainError } from "./tracker.js";

/** Per-process bounded counters; opaque keys never retain raw addresses or emails. */
export function createThrottle(now: () => number = Date.now, maximum = 10000) {
  const salt = randomBytes(32);
  const entries = new Map<string, { count: number; expires: number }>();
  let nextSweep = 0;
  return {
    /** Check one bucket; reject with a safe retry hint when full or storage saturated. */
    take(action: string, identity: string, limit: number, windowMs: number) {
      const instant = now();
      if (instant >= nextSweep || entries.size >= maximum) {
        for (const [key, value] of entries)
          if (value.expires <= instant) entries.delete(key);

        nextSweep = instant + 60000;
      }

      const key = createHmac("sha256", salt)
        .update(`${action}\n${identity}`)
        .digest("hex");

      const old = entries.get(key);
      if (!old && entries.size >= maximum)
        throw Object.assign(new DomainError("RATE_LIMITED"), {
          retryAfter: 60,
        });

      const value =
        old && old.expires > instant
          ? old
          : { count: 0, expires: instant + windowMs };

      entries.set(key, value);
      if (value.count >= limit)
        throw Object.assign(new DomainError("RATE_LIMITED"), {
          retryAfter: Math.max(1, Math.ceil((value.expires - instant) / 1000)),
        });

      value.count++;
    },
    /** Reserve a cooldown without exposing whether an address is known. */
    allow(action: string, identity: string, windowMs: number) {
      try {
        this.take(action, identity, 1, windowMs);
        return true;
      } catch (error) {
        if (error instanceof DomainError && error.code === "RATE_LIMITED")
          return false;

        throw error;
      }
    },
  };
}
