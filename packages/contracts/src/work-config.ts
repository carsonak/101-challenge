import { z } from "./validation.js";

/** Private worker destinations are operator configuration, never request inputs. */
const wakeUrl = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .url()
    .refine((v) => {
      const url = new URL(v);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/wake"
      );
    })
    .optional()
);

/** High-entropy service keys; generate independently and distribute through private environment settings. */
const secret = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
);

/** Shared idle-worker configuration. Millisecond bounds are intentionally finite. */
export const workConfig = {
  /** Resident timers or externally scheduled request execution. */
  WORK_MODE: z.enum(["resident", "request"]).default("resident"),
  /** Operator-owned private worker dispatch endpoint; never a client input. */
  WORKER_WAKE_URL: wakeUrl,
  /** Worker-only scan signing key; no database privileges. */
  WORKER_WAKE_SECRET: secret,
  /** Operator-owned private account-maintenance dispatch endpoint. */
  MAINTENANCE_WAKE_URL: wakeUrl,
  /** Independent maintenance scan key; does not authorize account operations. */
  MAINTENANCE_WAKE_SECRET: secret,
  /** Private maintenance bind address, loopback by default. */
  MAINTENANCE_HOST: z.string().min(1).default("127.0.0.1"),
  /** Private maintenance HTTP port. */
  MAINTENANCE_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  /** Initial recovery interval after an empty or future-only queue. */
  WORK_RECOVERY_MIN_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .max(86400000)
    .default(900000),
  /** Maximum interval for recovery of a lost wake hint. */
  WORK_RECOVERY_MAX_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .max(86400000)
    .default(3600000),
  /** Active housekeeping interval; known retention deadlines can run sooner. */
  HOUSEKEEPING_MIN_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .max(86400000)
    .default(3600000),
  /** Largest idle housekeeping interval. */
  HOUSEKEEPING_MAX_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .max(86400000)
    .default(86400000),
};

/** Lazy connections release quickly on idle and allow bounded database cold starts. */
export const databaseConfigSchema = z.object({
  /** Maximum connections in each pool, independent of replica count. */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  /** Bounded connection acquisition including database wake-up. */
  DB_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(15000),
});
