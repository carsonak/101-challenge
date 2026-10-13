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
