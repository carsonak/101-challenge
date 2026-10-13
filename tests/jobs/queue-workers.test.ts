/** @file Concurrent direct-outbox workers retain durable receipts without a second queue. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { startJobs } from "../../apps/worker/src/jobs.js";
import { parseServerConfig } from "../../packages/contracts/src/index.js";
import { createTracker } from "../../packages/core/src/index.js";
import {
  createJobStore,
  createRepository,
} from "../../packages/db/src/index.js";
import { target, url } from "./fixtures.js";

test(
  "Concurrent workers drain durable outbox records without pg-boss polling",
  { skip: !url },
  async () => {
    const isolated = await target();
    const db = createRepository(isolated.url);
    const one = createJobStore(isolated.url),
      two = createJobStore(isolated.url);

    const config = parseServerConfig({ WORK_MODE: "request" });
    const a = startJobs(one, config),
      b = startJobs(two, config);

    try {
      await db.migrate();
      const tracker = createTracker(db.repository);
      const admin = await tracker.createUser(true);
      const result = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional sleeping worker",
        },
        randomUUID()
      );

      await Promise.all([a.run(), b.run()]);
      const events = await db.repository.transaction((tx) =>
        tx.list("outbox", { aggregateId: result.resourceId })
      );

      assert.ok(events.length);
      assert.ok(events.every((event) => event.publishedAt));
      assert.equal(await one.nextDue(), null);
      for (const event of events)
        assert.equal(
          await two.process({
            eventId: event.id,
            type: event.type,
            aggregateId: event.aggregateId,
            sourceVersion: event.sourceVersion,
            occurredAt: event.occurredAt,
            schemaVersion: 1,
          }),
          "duplicate"
        );
    } finally {
      await a.stop();
      await b.stop();
      await one.close();
      await two.close();
      await db.close();
      await isolated.close();
    }
  }
);
