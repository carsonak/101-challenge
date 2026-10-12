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

    const seasonTitle = `Fictional guild fixture ${randomUUID()}`;
    const season = await tracker.execute(
      admin,
      {
        command: "CreateSeason",
        slug: randomUUID(),
        title: seasonTitle,
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

    /** Select an action by its visible label, not its opaque resource ID. */
    const buttonId = (label: string) => {
      const rows = delivered.at(-1)?.components as {
        components: { label: string; custom_id: string }[];
      }[];

      return required(
        rows.flatMap((row) => row.components).find((b) => b.label === label)
      ).custom_id;
    };

    /** Current labelled modal submission shape. */
    const submit = (
      id: string,
      body: string,
      extra: Record<string, unknown>[] = []
    ) => ({
      type: 5,
      data: {
        custom_id: id,
        components: [
          { type: 18, component: { type: 4, custom_id: "body", value: body } },
          ...extra,
        ],
      },
    });

    try {
      assert.equal((await invoke({ type: 1 }, subject, 0, true)).status, 401);
      assert.equal((await invoke({ type: 1 }, subject, 301)).status, 401);
      assert.deepEqual(await (await invoke({ type: 1 })).json(), { type: 1 });
      const longToken = `fictional_${"A".repeat(300)}`;
      assert.equal(
        (await invoke({ type: 2, token: longToken, data: { name: "help" } }))
          .status,
        200
      );

      assert.match(String(delivered.at(-1)?.content), /truthful report/);
      assert.match(
        String(delivered.at(-1)?.content),
        /^## Your daily practice/
      );

      assert.match(String(delivered.at(-1)?.content), /- `\/report`/);
      assert.equal(delivered.at(-1)?.flags, 64);
      assert.deepEqual(delivered.at(-1)?.allowed_mentions, { parse: [] });
      assert.equal(
        (await invoke({ type: 2, token: "", data: { name: "help" } })).status,
        400
      );

      const choices = await (
        await invoke({
          type: 4,
          data: {
            name: "join",
            options: [{ name: "season", focused: true, value: seasonTitle }],
          },
        })
      ).json();

      assert.equal(choices.type, 8);
      assert.equal(
        choices.data.choices.some(
          (c: { value: string }) => c.value === season.resourceId
        ),
        true
      );

      const dm = await (
        await invoke({ type: 2, guild_id: null, data: { name: "join" } })
      ).json();

      assert.equal(dm.data.flags, 64);
      const join = {
        type: 2,
        id: "999991",
        data: {
          name: "join",
          options: [{ name: "season", value: season.resourceId }],
        },
      };

      assert.equal((await (await invoke(join)).json()).type, 5);
      await invoke(join);
      const enrollment = required((await tracker.history(owner))[0]);
      assert.equal((await tracker.history(owner)).length, 1);
      const custom = buttonId("Custom goals");
      const stolen = await (
        await invoke({ type: 3, data: { custom_id: custom } }, otherSubject)
      ).json();

      assert.equal(stolen.type, 4);
      const opened = await (
        await invoke({ type: 3, data: { custom_id: custom } })
      ).json();

      assert.equal(opened.type, 9);
      assert.equal(opened.data.components[0].type, 18);
      assert.equal(opened.data.components[0].component.type, 4);
      const customSubmit = {
        type: 5,
        id: "999993",
        data: {
          custom_id: opened.data.custom_id,
          components: [
            {
              type: 18,
              component: {
                type: 4,
                custom_id: "goal1",
                value: "Private guild goal",
              },
            },
          ],
        },
      };

      await invoke(customSubmit);
      await invoke(customSubmit);
      assert.equal((await tracker.history(owner))[0].attempts.length, 1);
      const report = await (
        await invoke({ type: 2, data: { name: "report" } })
      ).json();

      assert.equal(report.type, 9);
      const accepted = {
        ...submit(report.data.custom_id, "fictional private guild report"),
        id: "999994",
      };

      await invoke(accepted);
      await invoke(accepted);
      assert.equal((await tracker.dailySummary(owner))[0].reportingDays, 1);
      assert.equal(
        JSON.stringify(delivered).includes("fictional private guild report"),
        false
      );

      const editing = await (
        await invoke({ type: 2, data: { name: "report" } })
      ).json();

      assert.equal(
        editing.data.components[0].component.value,
        "fictional private guild report"
      );

      // Force a version conflict, then prove that a complete escaped private copy is retained.
      const history = (await tracker.history(owner))[0];
      const acceptedReport = history.attempts[0].reports[0];
      await tracker.execute(
        owner,
        {
          command: "EditReport",
          reportId: acceptedReport.id,
          expectedReportVersion: acceptedReport.version,
          body: "Changed on web",
          goalValues: [],
        },
        randomUUID()
      );

      const recoveryText = `@everyone [private](https://example.invalid) ${"日".repeat(3900)}`;
      const before = delivered.length;
      await invoke(submit(editing.data.custom_id, recoveryText));
      const recovery = delivered
        .slice(before)
        .filter((d) =>
          String(d.content).startsWith("**Your private recovery copy**\n")
        )
        .map((d) =>
          String(d.content).slice("**Your private recovery copy**\n".length)
        )
        .join("");

      assert.equal(recovery.includes("日".repeat(3900)), true);
      assert.match(recovery, /@\u200beveryone/);
      assert.equal(
        delivered.slice(before).every((d) => String(d.content).length <= 2000),
        true
      );

      await invoke({ type: 2, data: { name: "dashboard" } });
      const pause = buttonId("Pause");
      const prompt = await (
        await invoke({ type: 3, data: { custom_id: pause } })
      ).json();

      assert.match(prompt.data.content, /current streak resets/);
      await invoke({
        type: 3,
        data: { custom_id: prompt.data.components[0].components[0].custom_id },
      });

      assert.equal((await tracker.history(owner))[0].participation, "paused");
      failDelivery = true;
      const resume = {
        type: 3,
        id: "999995",
        data: { custom_id: buttonId("Resume") },
      };

      await invoke(resume);
      await invoke(resume);
      assert.equal((await tracker.history(owner))[0].participation, "active");
      const resumes = await db.repository.transaction((tx) =>
        tx.list("replays", {
          userId: owner,
          command: "ResumeEnrollment",
          key: "discord:999995",
        })
      );

      assert.equal(resumes.length, 1);
      assert.ok(
        delivered.every(
          (d) =>
            d.flags === 64 &&
            JSON.stringify(d.allowed_mentions) ===
              '{ "parse": [] }'.replaceAll(" ", "")
        )
      );

      const expired = await db.interactionForm({
        userId: owner,
        kind: "report",
        resourceId: enrollment.id,
        version: 0,
        enrollmentId: enrollment.id,
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
        await invoke({ type: 3, data: { custom_id: expired } })
      ).json();

      assert.equal(expiredResponse.type, 4);
      failDelivery = false;
      await tracker.execute(
        admin,
        {
          command: "SaveSeasonTemplate",
          seasonId: season.resourceId,
          expectedSeasonVersion: 1,
          goals: [{ title: "Read pages", kind: "count", target: "10" }],
          milestones: [
            {
              title: "Finish the opening chapter",
              targetReportingDay: 1,
              achievementKind: "manual",
            },
          ],
        },
        randomUUID()
      );

      await invoke(
        {
          type: 2,
          data: {
            name: "join",
            options: [{ name: "season", value: season.resourceId }],
          },
        },
        otherSubject
      );

      await invoke(
        { type: 3, data: { custom_id: buttonId("Start recommended plan") } },
        otherSubject
      );

      const measuredModal = await (
        await invoke({ type: 2, data: { name: "report" } }, otherSubject)
      ).json();

      assert.equal(measuredModal.type, 9);
      assert.equal(measuredModal.data.components.length, 3);
      const numeric = measuredModal.data.components[1].component;
      const checkbox = measuredModal.data.components[2].component;
      assert.equal(checkbox.type, 22);
      const achievedId = checkbox.options[0].value;
      await invoke(
        submit(measuredModal.data.custom_id, "Fictional measured report", [
          {
            type: 18,
            component: { type: 4, custom_id: numeric.custom_id, value: "7" },
          },
          {
            type: 18,
            component: {
              type: 22,
              custom_id: "milestones",
              values: [achievedId],
            },
          },
        ]),
        otherSubject
      );

      const measuredHistory = (await tracker.history(other))[0].attempts[0];
      assert.equal(measuredHistory.reports[0].goalValues[0].value, "7");
      assert.equal(
        (await tracker.source(other, measuredHistory.attemptId)).reports[0]
          .milestoneFacts[0].achieved,
        true
      );

      const acceptedRevision =
        measuredHistory.reports[0].goalValues[0].goalRevisionId;

      await tracker.execute(
        other,
        {
          command: "SaveGoal",
          attemptId: measuredHistory.attemptId,
          expectedAttemptVersion: measuredHistory.version,
          goalId: measuredHistory.goals[0].id,
          goal: { title: "Revised pages", kind: "count", target: "20" },
        },
        randomUUID()
      );

      const summary = (await tracker.dailySummary(other))[0];
      assert.equal(summary.goals[0].revisionId, acceptedRevision);
      const measuredEdit = await (
        await invoke({ type: 2, data: { name: "report" } }, otherSubject)
      ).json();

      assert.equal(
        measuredEdit.data.components[1].component.custom_id,
        `goal:${acceptedRevision}`
      );

      assert.equal(measuredEdit.data.components[1].component.value, "7");
      assert.deepEqual(
        await tracker.dailySummary(await tracker.createUser()),
        []
      );

      const oversizedUser = await tracker.createUser(),
        oversizedSubject = `${Date.now()}3`;

      await db.repository.transaction((tx) =>
        tx.insert("identities", {
          id: randomUUID(),
          userId: oversizedUser,
          provider: "discord",
          subject: oversizedSubject,
        })
      );

      const oversizedEnrollment = await tracker.execute(
        oversizedUser,
        { command: "Enroll", seasonId: season.resourceId },
        randomUUID()
      );

      await tracker.execute(
        oversizedUser,
        {
          command: "StartAttempt",
          enrollmentId: oversizedEnrollment.resourceId,
          expectedEnrollmentVersion: 0,
          goals: Array.from({ length: 5 }, (_, index) => ({
            title: `Measured ${index}`,
            kind: "count",
            target: "10",
          })),
          milestones: [],
        },
        randomUUID()
      );

      const fallback = await (
        await invoke({ type: 2, data: { name: "report" } }, oversizedSubject)
      ).json();

      assert.equal(fallback.type, 4);
      assert.match(fallback.data.content, /more fields than Discord can show/);
      assert.equal(
        (await tracker.dailySummary(oversizedUser))[0].reportingDays,
        0
      );

      assert.ok(
        JSON.stringify(fallback).includes(
          `/challenge/${oversizedEnrollment.resourceId}`
        )
      );

      const beforeUnlink = delivered.length;
      await db.repository.transaction(async (tx) => {
        const identity = required(
          (
            await tx.list("identities", { userId: owner, provider: "discord" })
          )[0]
        );

        await tx.remove("identities", identity.id);
      });

      const unlinkedText = "Fictional text retained after unlinking";
      await invoke(submit(editing.data.custom_id, unlinkedText));
      assert.ok(
        delivered
          .slice(beforeUnlink)
          .some((message) => String(message.content).includes(unlinkedText))
      );

      assert.equal(
        (await tracker.dailySummary(owner))[0].report.body,
        "Changed on web"
      );

      assert.deepEqual(
        guildCommands.map((c) => c.name),
        ["dashboard", "report", "seasons", "join", "help"]
      );
    } finally {
      await db.close();
    }
  }
);
