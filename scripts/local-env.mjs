/** @file Read two local configuration files and select per-process settings. Importing does not read files or start services. */
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

/** Complete local runtime inventory; .env.example is checked against this list. */
export const runtimeKeys = [
  "APP_DISPLAY_NAME",
  "APP_ORIGIN",
  "PORT",
  "WEB_HOST",
  "WORKER_PORT",
  "WORKER_HOST",
  "COMPOSE_PROJECT_NAME",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "DATABASE_URL",
  "WORKER_DATABASE_URL",
  "QUEUE_SCHEMA",
  "MAIL_HTTP_PORT",
  "MAIL_SMTP_PORT",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_FROM",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_SECURE",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "DISCORD_PUBLIC_KEY",
  "REPORTING_TIMEZONE",
  "LOG_FORMAT",
  "TRUSTED_PROXY_HEADER",
  "TRUSTED_PROXY_HOPS",
  "OUTBOX_POLL_MS",
  "OUTBOX_IDLE_MAX_MS",
  "CONTACT_EMAIL",
  "LIVE_TEST_EMAIL",
  "DISCORD_PROXY_PORT",
  "DISCORD_PROXY_TARGET",
];
/** Privileged local inventory; only operator commands read .env.operator. */
export const operatorKeys = [
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "OPERATOR_DATABASE_URL",
  "MIGRATOR_DATABASE_URL",
  "ERASURE_DATABASE_URL",
  "MIGRATOR_DB_USER",
  "MIGRATOR_DB_PASSWORD",
  "WEB_DB_USER",
  "WEB_DB_PASSWORD",
  "WORKER_DB_USER",
  "WORKER_DB_PASSWORD",
  "MAINTENANCE_DB_USER",
  "MAINTENANCE_DB_PASSWORD",
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID",
];
/** Shared nonprivileged service settings. */
const common = [
  "APP_DISPLAY_NAME",
  "APP_ORIGIN",
  "REPORTING_TIMEZONE",
  "QUEUE_SCHEMA",
  "LOG_FORMAT",
];
/** SMTP transport belongs to web and private account maintenance. */
const smtp = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_FROM",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_SECURE",
];
/** Commands with access to the operator file; runtime commands never read it. */
export const operatorCommands = new Set([
  "migrate",
  "provision",
  "maintain",
  "maintenance",
  "register",
]);

/** Read optional local settings; malformed or unreadable files remain errors, rather than silent defaults. */
export async function readLocalSettings(file) {
  try {
    return parseEnv(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

/** Select a service environment with shell overrides; remove managed credentials for all other roles, including inherited ones. */
export function localEnvironment(
  command,
  runtime = {},
  operator = {},
  inherited = process.env
) {
  const sources = {
    ...runtime,
    ...(operatorCommands.has(command) ? operator : {}),
    ...inherited,
  };
  const env = { ...inherited };
  for (const key of new Set([
    ...runtimeKeys,
    ...operatorKeys,
    ...Object.keys(runtime),
    ...Object.keys(operator),
  ]))
    delete env[key];
  const scopes = {
    web: [
      ...common,
      ...smtp,
      "DATABASE_URL",
      "PORT",
      "WEB_HOST",
      "CONTACT_EMAIL",
      "TRUSTED_PROXY_HEADER",
      "TRUSTED_PROXY_HOPS",
      ...runtimeKeys.filter((key) =>
        /^(GOOGLE_|DISCORD_(CLIENT_|REDIRECT_|PUBLIC_))/.test(key)
      ),
    ],
    worker: [
      ...common,
      "WORKER_PORT",
      "WORKER_HOST",
      "OUTBOX_POLL_MS",
      "OUTBOX_IDLE_MAX_MS",
    ],
    migrate: ["LOG_FORMAT"],
    provision: [
      "OPERATOR_DATABASE_URL",
      "QUEUE_SCHEMA",
      "LOG_FORMAT",
      ...operatorKeys.filter((key) => /_DB_(USER|PASSWORD)$/.test(key)),
    ],
    maintain: [...common, ...smtp, "ERASURE_DATABASE_URL"],
    maintenance: [...common, ...smtp, "ERASURE_DATABASE_URL"],
    register: [
      "DISCORD_CLIENT_ID",
      "DISCORD_BOT_TOKEN",
      "DISCORD_GUILD_ID",
      "LOG_FORMAT",
    ],
    proxy: ["DISCORD_PROXY_PORT", "DISCORD_PROXY_TARGET"],
  };
  if (!scopes[command]) throw new Error(`Unknown local command: ${command}`);
  for (const key of scopes[command])
    if (sources[key] !== undefined) env[key] = sources[key];
  if (command === "worker") {
    if (!sources.WORKER_DATABASE_URL && sources.DATABASE_URL)
      throw new Error(
        "Set WORKER_DATABASE_URL in .env to the restricted worker connection; DATABASE_URL belongs to web."
      );
    if (sources.WORKER_DATABASE_URL)
      env.DATABASE_URL = sources.WORKER_DATABASE_URL;
  }
  if (command === "migrate") {
    if (!sources.MIGRATOR_DATABASE_URL)
      throw new Error(
        "Set MIGRATOR_DATABASE_URL in .env.operator before pnpm database:migrate."
      );
    env.DATABASE_URL = sources.MIGRATOR_DATABASE_URL;
  }
  if (command === "proxy" && !env.DISCORD_PROXY_TARGET)
    env.DISCORD_PROXY_TARGET = sources.APP_ORIGIN || "http://127.0.0.1:3000";
  return env;
}
