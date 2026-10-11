/** @file Owner-only Brevo acceptance: send verification/recovery to LIVE_TEST_EMAIL on the private localhost live database. Use --retry-recovery for an already verified test account; never resets its password or saves proof links in artifacts. */
import { randomBytes } from "node:crypto";
import { createRepository } from "@challenge/db";
import { createAuth, type AuthMail } from "../packages/core/src/index.js";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createMailer } from "../apps/web/server/mail.js";

/** Explicit local live environment prevents personal recipients entering disposable test data. */
const config = parseServerConfig(process.env);
const recipient = process.env.LIVE_TEST_EMAIL;
if (
  !recipient ||
  !config.DATABASE_URL ||
  new URL(config.DATABASE_URL).pathname !== "/challenge_live" ||
  new URL(config.APP_ORIGIN).hostname !== "localhost" ||
  new URL(config.APP_ORIGIN).protocol !== "http:"
)
  throw new Error(
    "Private localhost live database and LIVE_TEST_EMAIL required"
  );
/** Private service resources are released even if the provider refuses a message. */
const database = createRepository(config.DATABASE_URL, true),
  mailer = createMailer(config);
const messages: AuthMail[] = [];
const auth = createAuth(database.repository, {
  sendMail: async (message) => {
    await mailer.send(message);
    messages.push(message);
  },
});
try {
  const retry = process.argv.includes("--retry-recovery");
  if (!retry) {
    await auth.execute({
      action: "signup",
      username: "live-owner-check",
      email: recipient,
      password: randomBytes(32).toString("hex"),
    });
    const verification = messages.find((message) => message.kind === "verify");
    if (!verification) throw new Error("No verification delivery");
    await auth.execute({ action: "verify", token: verification.token });
  }
  await auth.execute({ action: "recover", email: recipient });
  if (!messages.some((message) => message.kind === "recover"))
    throw new Error("No recovery delivery");
  console.info(
    retry
      ? "Recovery retry accepted by SMTP; account password unchanged. Confirm inbox delivery separately."
      : "Verification and recovery accepted by SMTP; verification proof exercised. Confirm inbox delivery separately. Recovery link remains available to the owner."
  );
} catch {
  console.error(
    "Live mail acceptance failed; inspect private configuration without exposing recipients or links."
  );
  process.exitCode = 1;
} finally {
  mailer.close();
  await database.close();
}
