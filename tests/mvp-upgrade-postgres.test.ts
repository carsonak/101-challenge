/** @file Upgrade populated MVP data on an exclusive fictional database; preserve identities, history, completion and seed facts. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { createRepository } from "../packages/db/src/index.js";
import {
  createAuth,
  createTracker,
  type AuthMail,
  type Repository,
} from "../packages/core/src/index.js";

/** Explicit operator URL only for disposable PostgreSQL fixtures. */
const connection = process.env.TRACKER_TEST_DATABASE_URL;
if (connection && !/_(test|ci)$/.test(new URL(connection).pathname))
  throw new Error("Disposable database required");

/** DB-owned driver for the historical migration fixture and its cleanup. */
const { Pool } = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");

test(
  "Populated MVP upgrade preserves verified login, provider links, 101 reports, completion and seeds",
  { skip: !connection },
  async () => {
    const manager = new Pool({ connectionString: connection, max: 1 });
    const name = `mvp_upgrade_${randomUUID().replaceAll("-", "")}_test`;
    await manager.query(`CREATE DATABASE "${name}"`);
    const target = new URL(connection as string);
    target.pathname = `/${name}`;
    const sql = new Pool({ connectionString: target.toString(), max: 1 });
    const db = createRepository(target.toString());
    try {
      const baseline: { version: number; file: string }[] = JSON.parse(
        await readFile(
          new URL("./fixtures/mvp-migrations.json", import.meta.url),
          "utf8"
        )
      );

      await sql.query(
        "CREATE TABLE tracker_migrations(version integer PRIMARY KEY)"
      );

      for (const entry of baseline) {
        await sql.query(
          await readFile(
            new URL(`../packages/db/migrations/${entry.file}`, import.meta.url),
            "utf8"
          )
        );

        await sql.query("INSERT INTO tracker_migrations VALUES($1)", [
          entry.version,
        ]);
      }

      // Fixture construction emulates the historical absence of suspensions. Final
      // post-migration assertions use fresh services on the unwrapped repository.
      const historical: Repository = {
        transaction: (callback) =>
          db.repository.transaction((tx) =>
            callback({
              ...tx,
              get: async (table, id, lock) =>
                table === "account_suspensions"
                  ? undefined
                  : tx.get(table, id, lock),
            })
          ),
      };

      const mail: AuthMail[] = [];
      let auth = createAuth(historical, {
        now: () => new Date("2026-01-01T09:00:00Z"),
        sendMail: async (message) => {
          mail.push(message);
        },
      });

      const email = "mvp-upgrade@example.invalid";
      const password = "fictional MVP upgrade password";
      await auth.execute({
        action: "signup",
        username: "mvp_upgrade",
        email,
        password,
      });

      assert.ok(mail[0]);
      await auth.execute({ action: "verify", token: mail[0].token });
      const login = await auth.execute({ action: "login", email, password });
      assert.ok(
        "token" in login && login.token && "csrf" in login && login.csrf
      );

      const account = await auth.account(login.token);
      for (const provider of ["google", "discord"] as const) {
        const browser = randomBytes(32).toString("hex");
        const initiated = await auth.beginOAuth(
          provider,
          browser,
          login.token,
          login.csrf,
          true
        );

        const state = await auth.oauthState(provider, initiated.state, browser);
        await auth.completeOAuth(
          state.id,
          browser,
          { provider, subject: `fictional-${provider}` },
          login.token
        );
      }

      let instant = new Date("2026-01-01T09:00:00Z");
      let tracker = createTracker(historical, { now: () => instant });
      const admin = await tracker.createUser(true);
      const season = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: "mvp-upgrade",
          title: "Fictional upgrade season",
        },
        randomUUID()
      );

      await tracker.execute(
        admin,
        {
          command: "PublishSeason",
          seasonId: season.resourceId,
          expectedSeasonVersion: 0,
        },
        randomUUID()
      );

      const enrollment = await tracker.execute(
        account.id,
        { command: "Enroll", seasonId: season.resourceId },
        randomUUID()
      );

      const attempt = await tracker.execute(
        account.id,
        {
          command: "StartAttempt",
          enrollmentId: enrollment.resourceId,
          expectedEnrollmentVersion: enrollment.version,
          timezone: "Africa/Nairobi",
          goals: [{ title: "Fictional practice", kind: "qualitative" }],
          milestones: [],
        },
        randomUUID()
      );

      for (let index = 0; index < 101; index++) {
        instant = new Date(Date.UTC(2026, 0, index + 1, 9));
        await tracker.execute(
          account.id,
          {
            command: "SubmitReport",
            attemptId: attempt.resourceId,
            expectedAttemptVersion: index,
            body: "Fictional preserved report",
            goalValues: [],
          },
          randomUUID()
        );
      }

      const source = await tracker.source(account.id, attempt.resourceId);
      const history = await tracker.history(account.id);
      assert.equal(source.reports.length, 101);
      assert.ok(source.completion);
      const identities = await db.repository.transaction((tx) =>
        tx.list("identities", { userId: account.id })
      );

      assert.equal(identities.length, 2);
      const linkedAccount = await auth.account(login.token);
      const legacy = await sql.query(
        'UPDATE outbox SET "publishedAt"=now() RETURNING id'
      );

      assert.ok(legacy.rowCount > 0);
      await db.migrate();
      await db.migrate();
      tracker = createTracker(db.repository, { now: () => instant });
      auth = createAuth(db.repository, {
        now: () => new Date("2026-01-01T09:00:00Z"),
        sendMail: async () => {},
      });

      assert.equal(
        (
          await sql.query(
            "SELECT count(*)::int AS count FROM account_suspensions"
          )
        ).rows[0].count,
        0
      );

      assert.equal(
        (
          await sql.query(
            'SELECT count(*)::int AS count FROM outbox WHERE "publishedAt" IS NOT NULL'
          )
        ).rows[0].count,
        0
      );

      assert.equal(
        (await sql.query("SELECT count(*)::int AS count FROM outbox")).rows[0]
          .count,
        legacy.rowCount
      );

      assert.equal(await db.rates.allow("upgrade", "fictional", 60000), true);
      assert.deepEqual(
        await tracker.source(account.id, attempt.resourceId),
        source
      );

      assert.deepEqual(await tracker.history(account.id), history);
      assert.deepEqual(
        await db.repository.transaction((tx) =>
          tx.list("identities", { userId: account.id })
        ),
        identities
      );

      const after = await auth.execute({ action: "login", email, password });
      assert.ok("token" in after && after.token);
      assert.deepEqual(await auth.account(after.token), linkedAccount);
      const usernameOnly = `upgrade-${randomUUID()}`.slice(0, 40);
      await auth.execute({
        action: "signup",
        username: usernameOnly,
        password,
      });

      const fresh = await auth.execute({
        action: "login",
        username: usernameOnly,
        password,
      });

      assert.ok(fresh.token);
      const freshAccount = await auth.account(fresh.token);
      assert.equal(freshAccount.username.length, 40);
      assert.equal(freshAccount.recoveryEmail, null);
      assert.equal(freshAccount.hasPassword, true);
    } finally {
      await db.close();
      await sql.end();
      await manager.query(`DROP DATABASE "${name}"`);
      await manager.end();
    }
  }
);
