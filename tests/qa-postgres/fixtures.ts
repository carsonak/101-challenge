import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createAuth,
  createTracker,
  type AuthMail,
} from "../../packages/core/src/index.js";
import { createRepository } from "../../packages/db/src/index.js";
/** Explicit integration opt-in, never a participant database. */
export const url = process.env.TRACKER_TEST_DATABASE_URL;

if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");

/** Fictional strong password shared only by this test module. */
export const password = "fictional QA password 123";

/** Fixture owns its connections and deterministic current instant. */
export async function fixture() {
  assert.ok(url);
  const db = createRepository(url);
  await db.migrate();
  const app = createRepository(url, true);
  let now = new Date("2026-01-01T09:00:00.000Z");
  const tracker = createTracker(app.repository, { now: () => now });
  const mails: AuthMail[] = [];
  const auth = createAuth(app.repository, {
    now: () => now,
    sendMail: async (mail) => {
      mails.push(mail);
    },
  });

  const admin = await tracker.createUser(true),
    user = await tracker.createUser();

  const slug = `qa-${randomUUID()}`;
  const season = await tracker.execute(
    admin,
    { command: "CreateSeason", slug, title: "QA season" },
    randomUUID()
  );

  await tracker.execute(
    admin,
    {
      command: "SaveSeasonTemplate",
      seasonId: season.resourceId,
      expectedSeasonVersion: 0,
      goals: [{ title: "Practise", kind: "qualitative" }],
      milestones: [
        {
          title: "First report",
          targetReportingDay: 1,
          achievementKind: "reporting_count",
        },
      ],
    },
    randomUUID()
  );

  await tracker.execute(
    admin,
    {
      command: "PublishSeason",
      seasonId: season.resourceId,
      expectedSeasonVersion: 1,
    },
    randomUUID()
  );

  return {
    db,
    app,
    tracker,
    auth,
    mails,
    admin,
    user,
    slug,
    seasonId: season.resourceId,
    set(date: string) {
      now = new Date(date);
    },
    async close() {
      await app.close();
      await db.close();
    },
    async signup() {
      const email = `${randomUUID()}@example.test`,
        username = `qa-${randomUUID().slice(0, 20)}`;

      await auth.execute({ action: "signup", username, email, password });
      const proof = mails.at(-1);
      assert.ok(proof);
      await auth.execute({ action: "verify", token: proof.token });
      const session = await auth.execute({ action: "login", email, password });
      assert.ok("token" in session && session.token && session.csrf);
      return { email, username, token: session.token, csrf: session.csrf };
    },
    async current() {
      const e = (await tracker.history(user))[0];
      assert.ok(e);
      const a = e.attempts.find((a) => a.attemptId === e.currentAttemptId);
      assert.ok(a);
      return { e, a };
    },
  };
}
