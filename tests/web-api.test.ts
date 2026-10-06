/** @file Verifies browser trust boundaries against a disposable PostgreSQL database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import {
  createAuth,
  createTracker,
  type AuthMail,
} from "../packages/core/src/index.js";
import { createRepository } from "../packages/db/src/index.js";
import { createWebApi } from "../apps/web/server/api.js";
import { createProviders } from "../apps/web/server/providers.js";
/** Explicit disposable integration target. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable test database required");
/** Require a fictional fixture and preserve its inferred type. */
function required<T>(value: T | null | undefined): T {
  assert.ok(value != null);
  return value;
}

test(
  "Browser origin/CSRF, actor identity, replay, pagination and private projections",
  { skip: !url },
  async () => {
    const db = createRepository(required(url));
    await db.migrate();
    const mail: AuthMail[] = [];
    const auth = createAuth(db.repository, {
      sendMail: async (m) => {
        mail.push(m);
      },
    });
    const tracker = createTracker(db.repository);
    const config = parseServerConfig({ APP_ORIGIN: "http://localhost:3000" });
    const api = createWebApi({
      config,
      auth,
      tracker,
      providers: createProviders(config),
    });
    let cookies = "",
      csrf = "";
    const request = async (
      path: string,
      body?: unknown,
      extra: Record<string, string> = {}
    ) => {
      const response = await api.handle(
        new Request(`http://localhost:3000${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            origin: config.APP_ORIGIN,
            cookie: cookies,
            "x-csrf-token": csrf,
            "idempotency-key": randomUUID(),
            ...extra,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      );
      return response;
    };
    try {
      const email = `browser-${randomUUID()}@example.invalid`,
        password = "fictional browser password";
      assert.equal(
        (
          await request(
            "/api/v1/auth",
            { action: "signup", email, password },
            { origin: "https://evil.invalid" }
          )
        ).status,
        403
      );
      assert.equal(mail.length, 0);
      assert.equal(
        (await request("/api/v1/auth", { action: "signup", email, password }))
          .status,
        200
      );
      const proof = required(mail.at(-1));
      assert.equal(
        (
          await request("/api/v1/auth", {
            action: "verify",
            token: proof.token,
          })
        ).status,
        200
      );
      const login = await request("/api/v1/auth", {
        action: "login",
        email,
        password,
      });
      assert.deepEqual(await login.json(), { accepted: true });
      const headers = login.headers.getSetCookie();
      assert.ok(headers[0].includes("HttpOnly"));
      cookies = headers.map((h) => h.split(";")[0]).join("; ");
      csrf =
        headers
          .find((h) => h.startsWith("challenge_csrf="))
          ?.split(";")[0]
          .split("=")[1] ?? "";
      const context = await (await request("/api/v1/session")).json();
      const owner = context.account.id;
      assert.equal(JSON.stringify(context).includes(password), false);
      const admin = await tracker.createUser(true);
      const season = await tracker.execute(
        admin,
        { command: "CreateSeason", title: "Fictional browser season" },
        randomUUID()
      );
      const rows = await tracker.seasons(admin, true),
        draft = required(rows.find((s) => s.id === season.resourceId));
      await tracker.execute(
        admin,
        {
          command: "PublishSeason",
          seasonId: draft.id,
          expectedSeasonVersion: draft.version,
        },
        randomUUID()
      );
      const enrollment = { command: "Enroll", seasonId: draft.id };
      assert.equal(
        (
          await request("/api/v1/command", enrollment, {
            "x-csrf-token": "wrong",
          })
        ).status,
        403
      );
      assert.equal(
        (await request("/api/v1/command", { ...enrollment, userId: admin }))
          .status,
        400
      );
      const key = randomUUID(),
        first = await request("/api/v1/command", enrollment, {
          "idempotency-key": key,
        });
      assert.equal(first.status, 200);
      const ref = await first.json();
      assert.deepEqual(
        await (
          await request("/api/v1/command", enrollment, {
            "idempotency-key": key,
          })
        ).json(),
        { ...ref, replayed: true }
      );
      assert.equal((await tracker.history(owner)).length, 1);
      assert.equal((await request("/api/v1/admin/stats")).status, 403);
      const exported = await request("/api/v1/export");
      assert.ok(
        exported.headers.get("content-disposition")?.includes("attachment")
      );
      const text = await exported.text();
      assert.equal(
        /seed|passwordHash|tokenHash|contentDigest/.test(text),
        false
      );
      assert.equal((await request("/api/v1/seasons?limit=1")).status, 200);
      assert.equal((await request("/api/v1/seasons?limit=101")).status, 400);
      assert.equal(
        (await request("/api/v1/history?cursor=invalid")).status,
        400
      );
      assert.equal((await request("/api/v1/command", null)).status, 400);
    } finally {
      await db.close();
    }
  }
);
