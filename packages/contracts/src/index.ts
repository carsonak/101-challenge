import { z } from "zod";

/**
 * Validates health payloads received from web or worker services.
 * Use `.parse(value)` to require a valid payload, or `.safeParse(value)` to handle
 * validation failure without throwing.
 */
export const healthResponseSchema = z.object({
  /** Whether the service check succeeded or found the service unavailable. */
  status: z.enum(["ok", "unavailable"]),
  /** Web or worker service identified by the health payload. */
  service: z.enum(["web", "worker"]),
});
/** Health payload type for web/worker handlers and readiness-check results. */
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Accept optional nonempty settings, treating an empty environment value as absent. */
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
/** Validate an optional PostgreSQL URL, treating an empty value as absent. */
const databaseUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .url()
    .refine((value) => /^postgres(?:ql)?:\/\//.test(value))
    .optional()
);
/** Server settings and defaults accepted during service configuration. */
const envSchema = z.object({
  /** Display name for server-rendered application branding. */
  APP_DISPLAY_NAME: z
    .string()
    .min(1)
    .max(100)
    .default("BitDevs Kisumu 101 Challenge"),
  /** Optional PostgreSQL connection URL for services that access the database; keep server-side. */
  DATABASE_URL: databaseUrl,
  /** Port for the worker health listener; defaults to 3001. */
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /** Bind address for the worker health listener; defaults to loopback. */
  WORKER_HOST: z.string().min(1).default("127.0.0.1"),
  /** Database schema for worker queues; use distinct values for isolated stacks. */
  QUEUE_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,62}$/)
    .default("pgboss"),
  /** Optional Google login client ID; configure with its secret and redirect URI. */
  GOOGLE_CLIENT_ID: optionalString,
  /** Optional Google login client secret; keep server-side and configure the complete provider. */
  GOOGLE_CLIENT_SECRET: optionalString,
  /** Optional Google login callback URI; configure with the client ID and secret. */
  GOOGLE_REDIRECT_URI: optionalString,
  /** Optional Discord login client ID; configure with its secret and redirect URI. */
  DISCORD_CLIENT_ID: optionalString,
  /** Optional Discord login client secret; keep server-side and configure the complete provider. */
  DISCORD_CLIENT_SECRET: optionalString,
  /** Optional Discord login callback URI; configure with the client ID and secret. */
  DISCORD_REDIRECT_URI: optionalString,
  /** Optional Discord interaction verification key; independent of login configuration. */
  DISCORD_PUBLIC_KEY: optionalString,
});

// Parse only on the server; errors deliberately omit supplied values/secrets.
/**
 * Validate server settings before starting a service or using its configuration.
 * Pass an environment map such as `process.env`; load any .env file beforehand.
 * Empty optional settings are omitted, defaults are applied, and wholly absent
 * login providers are disabled. The returned settings can contain credentials
 * and must remain server-side.
 *
 * @param input Environment values to validate; the supplied map is not modified.
 * @returns Parsed settings under their environment names plus provider availability flags.
 * @throws {Error} If a setting is invalid or a login provider is only partly configured.
 */
export function parseServerConfig(input: Record<string, string | undefined>) {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`
    );
  }
  const env = result.data;
  /** Return whether a provider is fully configured; reject partial configuration. */
  function provider(name: string, values: (string | undefined)[]) {
    const configured = values.filter(Boolean).length;
    if (configured !== 0 && configured !== values.length) {
      throw new Error(`Incomplete ${name} configuration`);
    }
    return configured === values.length;
  }
  const googleEnabled = provider("Google", [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  ]);
  const discordEnabled = provider("Discord OAuth", [
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    env.DISCORD_REDIRECT_URI,
  ]);
  for (const uri of [env.GOOGLE_REDIRECT_URI, env.DISCORD_REDIRECT_URI]) {
    if (uri) {
      const parsed = z.url().safeParse(uri);
      if (!parsed.success || !/^https?:\/\//.test(uri))
        throw new Error("Invalid OAuth redirect URI");
    }
  }
  if (
    env.DISCORD_PUBLIC_KEY &&
    !/^[a-fA-F0-9]{64}$/.test(env.DISCORD_PUBLIC_KEY)
  ) {
    throw new Error("Invalid Discord public key");
  }
  return {
    ...env,
    /** Whether complete Google login settings are available when enabling that provider. */
    googleEnabled,
    /** Whether complete Discord login settings are available when enabling that provider. */
    discordEnabled,
  };
}

export * from "./tracker.js";
