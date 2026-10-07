import { z } from "zod";

/** Normalize independently verified credential addresses; never use email to merge accounts. */
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
/** Passwords preserve spaces and Unicode; impose bounded hashing work. */
const password = z.string().min(12).max(128);
/** Opaque one-use proof or session secret; store only its digest. */
const token = z.string().regex(/^[a-f0-9]{64}$/);
/** Unique case-insensitive account handle. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .transform((v) => v.toLowerCase());
/** Email signup, login, verification and recovery payloads. */
export const authCommandSchema = z.union([
  z.strictObject({
    action: z.literal("signup"),
    email,
    password,
    username: usernameSchema,
  }),
  z.strictObject({ action: z.literal("login"), email, password }),
  z.strictObject({ action: z.literal("recover"), email }),
  z.strictObject({ action: z.literal("verify"), token }),
  z.strictObject({ action: z.literal("reset"), token, password }),
  z.strictObject({ action: z.literal("logout") }),
  z.strictObject({
    action: z.literal("save_profile"),
    username: usernameSchema,
  }),
  z.strictObject({
    action: z.literal("set_avatar"),
    avatar: z.string().max(400000).nullable(),
  }),
  z.strictObject({ action: z.literal("recovery_email"), email }),
  z.strictObject({ action: z.literal("verify_recovery_email"), token }),
  z.strictObject({ action: z.literal("restore_account") }),
  z.strictObject({ action: z.literal("revoke_session"), sessionId: z.uuid() }),
  z.strictObject({
    action: z.literal("notification"),
    id: z.uuid(),
    dismiss: z.boolean().default(false),
  }),
  z.strictObject({ action: z.literal("reauthenticate"), password }),
  z.strictObject({ action: z.literal("add_email"), email, password }),
  z.strictObject({
    action: z.literal("unlink"),
    provider: z.enum(["email", "google", "discord"]),
  }),
  z.strictObject({
    action: z.literal("request_erasure"),
    confirmed: z.literal(true),
    username: usernameSchema,
  }),
]);
/** Validated auth request; actor/session proof is supplied by the server adapter. */
export type AuthCommand = z.infer<typeof authCommandSchema>;
/** Safe owner account settings; excludes password/session/provider secrets. */
export const accountSchema = z.strictObject({
  id: z.uuid(),
  username: z.string(),
  provisional: z.boolean(),
  avatar: z.string().nullable(),
  recoveryEmail: z.string().nullable(),
  deletion: z
    .object({ requestedAt: z.iso.datetime(), deleteAfter: z.iso.datetime() })
    .nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  providers: z.array(z.enum(["google", "discord"])),
  admin: z.boolean(),
});
