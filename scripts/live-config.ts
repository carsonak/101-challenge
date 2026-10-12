/** @file Validate owner-supplied local configuration or authenticate SMTP without sending any mail. Never prints credentials. */
import { createRequire } from "node:module";
import { parseServerConfig } from "../packages/contracts/src/index.js";
/** Validate with safe configuration errors only. */
const config = parseServerConfig(process.env);
if (process.argv.includes("--smtp")) {
  const { default: nodemailer } = await import(
    createRequire(new URL("../apps/web/package.json", import.meta.url)).resolve(
      "nodemailer"
    )
  );

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    requireTLS: !config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
  });

  try {
    await transport.verify();
    console.info("SMTP TLS/authentication verified; no message sent.");
  } catch {
    console.error(
      "SMTP verification failed; check private credentials, sender access and network connectivity."
    );

    process.exitCode = 1;
  } finally {
    transport.close();
  }
} else
  console.info(
    JSON.stringify({
      valid: true,
      google: config.googleEnabled,
      discord: config.discordEnabled,
      interactionKey: Boolean(config.DISCORD_PUBLIC_KEY),
      smtpPort: config.SMTP_PORT,
      smtpSecure: config.SMTP_SECURE,
    })
  );
