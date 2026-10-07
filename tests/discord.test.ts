/** @file Signed guild fixtures use fictional linked accounts and a disposable database. */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import test from "node:test";
import { createRequire } from "node:module";
import { createAuth, createTracker } from "../packages/core/src/index.js";
import { createRepository } from "../packages/db/src/index.js";
import {
  createDiscordAdapter,
  guildCommands,
} from "../apps/web/server/discord.js";
/** Disposable PostgreSQL target only. */
const url = process.env.TRACKER_TEST_DATABASE_URL;
if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");
/** Require a fictional fixture and preserve its inferred type. */
function required<T>(value: T | null | undefined): T {
  assert.ok(value != null);
  return value;
}

test(
  "Guild signatures, private responses, actor-bound confirmations and command parity",
  { skip: !url },
  async () => {
    const db = createRepository(required(url));
    await db.migrate();
    const tracker = createTracker(db.repository),
      auth = createAuth(db.repository, { sendMail: async () => {} });
    const owner = await tracker.createUser(),
      other = await tracker.createUser(),
      admin = await tracker.createUser(true),
      subject = `${Date.now()}1`,
      otherSubject = `${Date.now()}2`;
    await db.repository.transaction(async (tx) => {
      await tx.insert("identities", {
        id: randomUUID(),
        userId: owner,
        provider: "discord",
        subject,
      });
      await tx.insert("identities", {
        id: randomUUID(),
        userId: other,
        provider: "discord",
        subject: otherSubject,
      });
    });
    const season = await tracker.execute(
      admin,
      {
        command: "CreateSeason",
        slug: randomUUID(),
        title: "Fictional guild fixture",
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
    const keys = generateKeyPairSync("ed25519"),
      publicKey = keys.publicKey
        .export({ format: "der", type: "spki" })
        .subarray(-32)
        .toString("hex"),
      tasks: (() => Promise<void>)[] = [],
      delivered: Record<string, unknown>[] = [];
    let failDelivery = false;
    const adapter = createDiscordAdapter({
      publicKey,
      origin: "http://localhost:3000",
      auth,
      tracker,
      database: db,
      schedule: (w) => tasks.push(w),
      deliver: async (_a, _t, data) => {
        if (failDelivery) throw new Error("Fictional delivery outage");
        delivered.push(data as Record<string, unknown>);
      },
    });
    let seq = 1;
    const invoke = async (
      value: Record<string, unknown>,
      who = subject,
      age = 0,
      forged = false
    ) => {
      const body = JSON.stringify({
          id: `${Date.now()}${seq++}`,
          application_id: "111",
          token: "fictional_token",
          guild_id: "222",
          member: { user: { id: who } },
          ...value,
        }),
        timestamp = String(Math.floor(Date.now() / 1000) - age);
      const signature = sign(
        null,
        Buffer.from(timestamp + body),
        keys.privateKey
      ).toString("hex");
      const response = await adapter.handle(
        new Request("http://localhost:3000/api/discord", {
          method: "POST",
          headers: {
            "x-signature-ed25519": forged ? "0".repeat(128) : signature,
            "x-signature-timestamp": timestamp,
          },
          body,
        })
      );
      while (tasks.length) await required(tasks.shift())();
      return response;
    };
    try {
      assert.equal((await invoke({ type: 1 }, subject, 0, true)).status, 401);
      assert.equal((await invoke({ type: 1 }, subject, 301)).status, 401);
      assert.equal(delivered.length, 0);
      assert.deepEqual(await (await invoke({ type: 1 })).json(), { type: 1 });
      const dm = await (
        await invoke({ type: 2, guild_id: null, data: { name: "join" } })
      ).json();
      assert.equal(dm.data.flags, 64);
      assert.equal((await tracker.history(owner)).length, 0);
      const join = {
        type: 2,
        id: "999991",
        data: {
          name: "join",
          options: [{ name: "id", value: season.resourceId }],
        },
      };
      assert.equal((await (await invoke(join)).json()).type, 5);
      await invoke(join);
      assert.equal((await tracker.history(owner)).length, 1);
      const e = (await tracker.history(owner))[0];
      assert.ok(e);
      await invoke({
        type: 2,
        data: { name: "setup", options: [{ name: "id", value: e.id }] },
      });
      const setup = delivered.at(-1) as {
        components: { components: { custom_id: string }[] }[];
      };
      const form = setup.components[0].components[0].custom_id;
      const stolen = await (
        await invoke({ type: 3, data: { custom_id: form } }, otherSubject)
      ).json();
      assert.equal(stolen.type, 4);
      assert.match(stolen.data.content, /another account/);
      const opened = await (
        await invoke({ type: 3, data: { custom_id: form } })
      ).json();
      assert.equal(opened.type, 9);
      assert.equal(opened.data.components[0].components[0].type, 4);
      const formId = opened.data.custom_id;
      const setupSubmit = {
        type: 5,
        data: {
          custom_id: formId,
          components: [
            {
              components: [
                {
                  custom_id: "goals",
                  value: JSON.stringify([
                    { title: "Private guild goal", kind: "qualitative" },
                  ]),
                },
                { custom_id: "timezone", value: "UTC" },
              ],
            },
          ],
        },
      };
      await invoke(setupSubmit);
      await invoke(setupSubmit);
      const h = (await tracker.history(owner))[0];
      assert.equal(h.attempts.length, 1);
      await invoke({
        type: 2,
        data: { name: "update", options: [{ name: "id", value: e.id }] },
      });
      const update = delivered.at(-1) as typeof setup;
      const updateModal = await (
        await invoke({
          type: 3,
          data: { custom_id: update.components[0].components[0].custom_id },
        })
      ).json();
      const submit = {
        type: 5,
        data: {
          custom_id: updateModal.data.custom_id,
          components: [
            {
              components: [
                { custom_id: "body", value: "fictional private guild report" },
                { custom_id: "values", value: "[]" },
                { custom_id: "milestones", value: "[]" },
              ],
            },
          ],
        },
      };
      await invoke(submit);
      await invoke(submit);
      assert.equal(
        (await tracker.history(owner))[0].attempts[0].reportingDays,
        1
      );
      assert.equal(
        JSON.stringify(delivered).includes("fictional private guild report"),
        false
      );
      await invoke({
        type: 2,
        data: { name: "cancel", options: [{ name: "id", value: e.id }] },
      });
      assert.match(String(delivered.at(-1)?.content), /Confirm cancellation/);
      assert.equal((await tracker.history(owner))[0].participation, "active");
      await invoke({
        type: 2,
        data: { name: "pause", options: [{ name: "id", value: e.id }] },
      });
      assert.equal((await tracker.history(owner))[0].participation, "paused");
      assert.ok(
        delivered.every(
          (d) =>
            d.flags === 64 &&
            JSON.stringify(d.allowed_mentions) === '{"parse":[]}'
        )
      );
      const expired = await db.interactionForm({
        userId: owner,
        kind: "setup",
        resourceId: e.id,
        version: 0,
        enrollmentId: e.id,
        enrollmentVersion: 0,
      });
      const { Pool } = createRequire(
        new URL("../packages/db/package.json", import.meta.url)
      )("pg");
      const fixturePool = new Pool({ connectionString: required(url), max: 1 });
      try {
        await fixturePool.query(
          'UPDATE adapter_confirmations SET "expiresAt"=$1 WHERE id=$2',
          ["2000-01-01T00:00:00Z", expired]
        );
      } finally {
        await fixturePool.end();
      }
      const expiredResponse = await (
        await invoke({ type: 3, data: { custom_id: `open:${expired}` } })
      ).json();
      assert.equal(expiredResponse.type, 4);
      assert.match(expiredResponse.data.content, /expired/);
      failDelivery = true;
      const resume = {
        type: 2,
        id: "999992",
        data: { name: "resume", options: [{ name: "id", value: e.id }] },
      };
      await invoke(resume);
      await invoke(resume);
      assert.equal((await tracker.history(owner))[0].participation, "active");
      const resumes = await db.repository.transaction((tx) =>
        tx.list("replays", {
          userId: owner,
          command: "ResumeEnrollment",
          key: "discord:999992",
        })
      );
      assert.equal(resumes.length, 1);
      assert.equal(guildCommands.length, 14);
    } finally {
      await db.close();
    }
  }
);
