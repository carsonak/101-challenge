import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  service: z.enum(["web", "worker"]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);
const databaseUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .url()
    .refine((value) => /^postgres(?:ql)?:\/\//.test(value))
    .optional()
);
const envSchema = z.object({
  APP_DISPLAY_NAME: z
    .string()
    .min(1)
    .max(100)
    .default("BitDevs Kisumu 101 Challenge"),
  DATABASE_URL: databaseUrl,
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WORKER_HOST: z.string().min(1).default("127.0.0.1"),
  QUEUE_SCHEMA: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,62}$/)
    .default("pgboss"),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
  DISCORD_REDIRECT_URI: optionalString,
  DISCORD_PUBLIC_KEY: optionalString,
});

// Parse only on the server; errors deliberately omit supplied values/secrets.
export function parseServerConfig(input: Record<string, string | undefined>) {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(", ")}`
    );
  }
  const env = result.data;
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
  return { ...env, googleEnabled, discordEnabled };
}
