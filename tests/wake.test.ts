/** @file Signed private wake requests cannot inject work or access the database before authentication. */
import assert from "node:assert/strict";
import test from "node:test";
import { signWake, verifyWake } from "../packages/core/src/wake.js";
import { createWorkLoop } from "../packages/core/src/work-loop.js";
import { serveWorker } from "../apps/worker/src/service.js";
import { createWakeClient } from "../apps/web/server/wake.js";
import { parseServerConfig } from "../packages/contracts/src/index.js";

const secret = "a".repeat(64);

test("Signatures bind service and time and reject malformed/stale input", () => {
  const now = 1800000000000,
    timestamp = String(now);

  const signature = signWake(secret, "worker", timestamp);
  assert.equal(verifyWake(secret, "worker", timestamp, signature, now), true);
  assert.equal(
    verifyWake(secret, "maintenance", timestamp, signature, now),
    false
  );

  assert.equal(
    verifyWake(secret, "worker", timestamp, signature, now + 60001),
    false
  );

  assert.equal(
    verifyWake(undefined, "worker", timestamp, signature, now),
    false
  );

  assert.equal(verifyWake(secret, "worker", timestamp, "00", now), false);
});

test("Health and rejected wake requests do no database work; valid request sweeps are coalesced", async () => {
  let scans = 0;
  const loop = createWorkLoop({
    minMs: 1000,
    maxMs: 8000,
    recoveryMinMs: 60000,
    recoveryMaxMs: 240000,
    resident: false,
    run: async () => {
      scans++;
      return null;
    },
    onError: assert.fail,
  });

  const server = serveWorker({
    service: "worker",
    host: "127.0.0.1",
    port: 0,
    secret,
    resident: false,
    loop,
    ready: async () => {
      scans++;
    },
    close: async () => {},
  });

  await server.start();
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/wake`, { method: "POST" })).status, 401);
    const timestamp = String(Date.now());
    const headers = {
      "x-work-timestamp": timestamp,
      "x-work-signature": signWake(secret, "worker", timestamp),
    };

    assert.equal(
      (await fetch(`${base}/wake`, { method: "POST", headers, body: "erase" }))
        .status,
      400
    );

    assert.equal(scans, 0);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${base}/wake`, { method: "POST", headers })
      )
    );

    assert.ok(results.every((r) => r.status === 200));
    assert.equal(scans, 1);
    assert.ok(results[0]);
    assert.ok((await results[0].json()).nextRunAt);
  } finally {
    await server.close();
  }
});

test("Notifier coalesces commits, retries a failed hint and never follows redirects", async () => {
  const scheduled: (() => Promise<void>)[] = [];
  let calls = 0;
  const client = createWakeClient(
    parseServerConfig({
      WORKER_WAKE_URL: "https://worker.example.invalid/wake",
      WORKER_WAKE_SECRET: secret,
    }),
    (task) => scheduled.push(task),
    async (_url, options) => {
      calls++;
      assert.equal(options?.redirect, "error");
      assert.equal(options?.body, undefined);
      const headers = new Headers(options?.headers);
      assert.equal(
        verifyWake(
          secret,
          "worker",
          headers.get("x-work-timestamp") ?? undefined,
          headers.get("x-work-signature") ?? undefined
        ),
        true
      );

      return new Response(null, { status: calls === 1 ? 503 : 202 });
    }
  );

  client("worker");
  client("worker");
  client("maintenance");
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0]);
  await scheduled[0]();
  assert.equal(calls, 2);
});

test("A cold gateway can retain its deadline after 20 seconds without a duplicate hint", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1800000000000 });
  const budgets: number[] = [];
  t.mock.method(AbortSignal, "timeout", (budget: number) => {
    budgets.push(budget);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("timeout")), budget);
    return controller.signal;
  });

  const scheduled: (() => Promise<void>)[] = [];
  let calls = 0;
  let retainedDeadline: number | undefined;
  const config = parseServerConfig({
    WORKER_WAKE_URL: "https://gateway.example.invalid/wake",
    WORKER_WAKE_SECRET: secret,
  });

  assert.equal(config.WAKE_DELIVERY_TIMEOUT_MS, 30000);
  const client = createWakeClient(
    config,
    (task) => scheduled.push(task),
    async (_url, options) => {
      calls++;
      return new Promise<Response>((resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("timeout")),
          { once: true }
        );

        setTimeout(() => {
          retainedDeadline = Date.now() + 1000;
          resolve(new Response(null, { status: 200 }));
        }, 20000);
      });
    }
  );

  client("worker");
  client("worker");
  const task = scheduled[0];
  assert.ok(task);
  const delivery = task();
  t.mock.timers.tick(19999);
  assert.equal(retainedDeadline, undefined);
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  await delivery;
  assert.equal(retainedDeadline, Date.now() + 1000);
  assert.equal(calls, 1);
  assert.deepEqual(budgets, [30000]);
});

test("Unavailable gateways use the configured timeout and stop after three attempts", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1800000000000 });
  const budgets: number[] = [];
  t.mock.method(AbortSignal, "timeout", (budget: number) => {
    budgets.push(budget);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("timeout")), budget);
    return controller.signal;
  });

  const scheduled: (() => Promise<void>)[] = [];
  let calls = 0;
  const client = createWakeClient(
    parseServerConfig({
      WORKER_WAKE_URL: "https://gateway.example.invalid/wake",
      WORKER_WAKE_SECRET: secret,
      WAKE_DELIVERY_TIMEOUT_MS: "1000",
    }),
    (task) => scheduled.push(task),
    async (_url, options) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("timeout")),
          { once: true }
        );
      });
    }
  );

  client("worker");
  const task = scheduled[0];
  assert.ok(task);
  const delivery = task();
  for (let attempt = 1; attempt <= 3; attempt++) {
    assert.equal(calls, attempt);
    t.mock.timers.tick(1000);
    // Flush the rejected transport and notifier continuation before the next tick.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  await delivery;
  assert.equal(calls, 3);
  assert.deepEqual(budgets, [1000, 1000, 1000]);
});
