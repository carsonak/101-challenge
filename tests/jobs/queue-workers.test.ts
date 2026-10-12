/** @file Two pg-boss workers share only their isolated queue and process real deliveries. Registered through the parent suite; uses only fictional fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { startJobs } from "../../apps/worker/src/jobs.js";
import { createTracker } from "../../packages/core/src/index.js";
import {
  createJobStore,
  createRepository,
} from "../../packages/db/src/index.js";
import { require, required, target, url } from "./fixtures.js";
test(
  "Two pg-boss workers share only their isolated queue and process real deliveries",
  { skip: !url },
  async () => {
    const { PgBoss } = require("pg-boss");
    const schema = `pgboss_fixture_${randomUUID().replaceAll("-", "")}`;
    const isolated = await target();
    const db = createRepository(isolated.url);
    await db.migrate();
    const one = createJobStore(
        isolated.url,
        () => new Date("2000-01-01T00:00:00Z")
      ),
      two = createJobStore(
        isolated.url,
        () => new Date("2000-01-01T00:00:00Z")
      );

    const bosses = [
      new PgBoss({ connectionString: isolated.url, schema }),
      new PgBoss({ connectionString: isolated.url, schema }),
    ];

    let stopA: undefined | (() => Promise<void>),
      stopB: undefined | (() => Promise<void>);

    for (const b of bosses) b.on("error", () => {});

    try {
      for (const b of bosses) await b.start();

      stopA = await startJobs(bosses[0], one);
      stopB = await startJobs(bosses[1], two);
      const tracker = createTracker(db.repository),
        admin = await tracker.createUser(true);

      const s = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional queue season",
        },
        randomUUID()
      );

      const event = required(
        (
          await db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: s.resourceId })
          )
        ).at(-1)
      );

      await one.publish(async (envelope) => {
        await bosses[0].send("tracker_projection", envelope, {
          singletonKey: envelope.eventId,
        });
      });

      const deadline = Date.now() + 15000;
      let status = "";
      while (Date.now() < deadline) {
        const job = await bosses[0].findJobs("tracker_projection", {
          data: { eventId: event.id },
        });

        status = job[0]?.state ?? "";
        if (status === "completed") break;

        await new Promise((r) => setTimeout(r, 250));
      }

      assert.equal(status, "completed");
      assert.equal(
        (await db.repository.transaction((tx) => tx.get("outbox", event.id)))
          ?.publishedAt !== null,
        true
      );
    } finally {
      await stopA?.();
      await stopB?.();
      for (const b of bosses) await b.stop();

      await one.close();
      await two.close();
      await db.close();
      await isolated.close();
    }
  }
);
