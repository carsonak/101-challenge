/** @file Register shared commands. Default dry-run; --apply writes one guild, --global explicitly targets global commands. */
import { guildCommands } from "../apps/web/server/discord.js";
/** Use the shared redacted CLI reporter rather than swallowing provider errors. */
const { reportCliFailure } = await import("./cli-diagnostics.mjs" as string);
/** Explicit write switch; bot token belongs only to this operator process. */
const apply = process.argv.includes("--apply"),
  global = process.argv.includes("--global");
/** Require a validated snowflake without printing private configuration. */
function identifier(name: string) {
  const value = process.env[name];
  if (!value || !/^\d{1,30}$/.test(value))
    throw new Error(`Missing or invalid ${name}`);
  return value;
}
try {
  if (!apply)
    console.info(
      JSON.stringify(
        { mode: global ? "global" : "guild", commands: guildCommands },
        null,
        2
      )
    );
  else {
    const application = identifier("DISCORD_CLIENT_ID");
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error("DISCORD_BOT_TOKEN required for registration");
    const path = global
      ? `applications/${application}/commands`
      : `applications/${application}/guilds/${identifier("DISCORD_GUILD_ID")}/commands`;
    const response = await fetch(`https://discord.com/api/v10/${path}`, {
      method: "PUT",
      headers: {
        authorization: `Bot ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(guildCommands),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const details = (await response.json().catch(() => ({}))) as {
        message?: unknown;
        code?: unknown;
      };
      throw Object.assign(
        new Error(
          `Discord HTTP ${response.status}: ${typeof details.message === "string" ? details.message.slice(0, 500) : "Registration rejected"}`
        ),
        {
          code:
            typeof details.code === "number" ? String(details.code) : undefined,
        }
      );
    }
    console.info("Commands registered.");
  }
} catch (error) {
  reportCliFailure(
    "discord:register",
    error,
    "Check DISCORD_CLIENT_ID in .env, bot token/guild in .env.operator and installation with bot + applications.commands scopes; --apply targets that guild."
  );
  process.exitCode = 1;
}
