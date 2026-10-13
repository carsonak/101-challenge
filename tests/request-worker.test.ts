/** @file Request-mode scheduler handoff drains real PostgreSQL queues in bounded batches. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createTracker, signWake } from "../packages/core/src/index.js";
import { createRepository, createJobStore } from "../packages/db/src/index.js";
import { startJobs } from "../apps/worker/src/jobs.js";
import { serveWorker } from "../apps/worker/src/service.js";
import { target, url } from "./jobs/fixtures.js";

const { Pool } = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");

test(
  "Request-mode wake hands each backlog deadline to the scheduler and drains 45 events in 20/20/5 batches",
  { skip: !url },
  async () => {
    const isolated = await target();
    const db = createRepository(isolated.url);
    const store = createJobStore(isolated.url);
    const sql = new Pool({ connectionString: isolated.url });
    const secret = "a".repeat(64);
    const config = parseServerConfig({
      WORK_MODE: "request",
      WORKER_WAKE_SECRET: secret,
      OUTBOX_POLL_MS: "1000",
      WORK_RECOVERY_MIN_MS: "60000",
      HOUSEKEEPING_MIN_MS: "60000",
    });

    let instant = Date.now();
    let batches = 0;
    const loop = startJobs(
      {
        ...store,
        async publish(deliver) {
          batches++;
          return store.publish(deliver);
        },
      },
      config,
      () => instant
    );

    const server = serveWorker({
      service: "worker",
      host: "127.0.0.1",
      port: 0,
      secret,
      resident: false,
      loop,
      ready: store.ready,
      close: store.close,
    });

    try {
      await db.migrate();
      const tracker = createTracker(db.repository);
      const admin = await tracker.createUser(true);
      const season = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional multi-batch queue",
        },
        randomUUID()
      );

      await db.repository.transaction(async (tx) => {
        const events = await tx.list("outbox", {
          aggregateId: season.resourceId,
        });

        assert.equal(events.length, 1);
        const event = events[0];
        assert.ok(event);
        for (let i = 1; i < 45; i++)
          await tx.insert("outbox", { ...event, id: randomUUID() });
      });

      await server.start();
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const endpoint = `http://127.0.0.1:${address.port}/wake`;
      for (const [index, expectedRemaining] of [25, 5, 0].entries()) {
        const before = instant;
        const timestamp = String(Date.now());
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "x-work-timestamp": timestamp,
            "x-work-signature": signWake(secret, "worker", timestamp),
          },
        });

        assert.equal(response.status, 200);
        const nextRunAt = Date.parse((await response.json()).nextRunAt);
        assert.ok(Number.isFinite(nextRunAt));
        assert.equal(batches, index + 1, "one publish batch per request");
        const state = await sql.query(
          `SELECT count(*) FILTER (WHERE "publishedAt" IS NULL)::int AS remaining,
            (SELECT count(*)::int FROM event_receipts) AS receipts FROM outbox`
        );

        assert.equal(state.rows[0].remaining, expectedRemaining);
        assert.equal(state.rows[0].receipts, 45 - expectedRemaining);
        if (expectedRemaining)
          assert.equal(nextRunAt - before, config.OUTBOX_POLL_MS);
        else assert.ok(nextRunAt - before > config.OUTBOX_IDLE_MAX_MS);

        // The external scheduler retains the response and invokes at that deadline.
        instant = nextRunAt;
      }

      assert.equal(await store.nextDue(), null);
    } finally {
      await server.close();
      await db.close();
      await sql.end();
      await isolated.close();
    }
  }
);
