import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuth, type AuthMail } from "../../packages/core/src/index.js";
import { createRepository } from "../../packages/db/src/index.js";
/** Explicit test target; real participant databases are rejected. */
export const url = process.env.TRACKER_TEST_DATABASE_URL;

if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Integration database must end in _test or _ci");

/** Assert fixture existence while preserving its inferred type. */
export function required<T>(value: T | null | undefined): T {
  assert.ok(value !== undefined && value !== null);
  return value;
}

/** Fictional account address, unique across repeatable test runs. */
export const email = () => `fixture-${randomUUID()}@example.invalid`;

/** Strong fictional test password. */
export const password = "fictional correct horse battery";

/** Create isolated service dependencies and inspect only fictional mail deliveries. */
export async function fixture() {
  const db = createRepository(required(url));
  await db.migrate();
  const mail: AuthMail[] = [];
  let instant = new Date("2026-10-06T06:00:00Z");
  const auth = createAuth(db.repository, {
    now: () => instant,
    sendMail: async (message) => {
      mail.push(message);
    },
  });

  return {
    db,
    auth,
    mail,
    advance(minutes: number) {
      instant = new Date(instant.getTime() + minutes * 60000);
    },
    async signup() {
      const address = email();
      await auth.execute({
        action: "signup",
        username: randomUUID().slice(0, 32),
        email: address,
        password,
      });

      const proof = required(mail.at(-1));
      await auth.execute({ action: "verify", token: proof.token });
      const result = await auth.execute({
        action: "login",
        email: address,
        password,
      });

      assert.ok("token" in result && "csrf" in result);
      return {
        address,
        token: required(result.token),
        csrf: required(result.csrf),
      };
    },
  };
}
