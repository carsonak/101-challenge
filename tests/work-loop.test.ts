/** @file Deterministic sleep, deadline, coalescing and failure scheduling without database traffic. */
import assert from "node:assert/strict";
import test from "node:test";
import { createWorkLoop } from "../packages/core/src/work-loop.js";
import { parseServerConfig } from "../packages/contracts/src/index.js";

const timing = {
  minMs: 1000,
  maxMs: 8000,
  recoveryMinMs: 60000,
  recoveryMaxMs: 240000,
};

test("Empty resident loops make no queries until recovery or a poke, and deadlines survive inactivity", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  let scans = 0;
  let due: number | null = null;
  const loop = createWorkLoop({
    ...timing,
    resident: true,
    run: async () => {
      scans++;
      return due;
    },
    onError: assert.fail,
  });

  try {
    await loop.run();
    t.mock.timers.tick(59000);
    assert.equal(scans, 1);
    due = Date.now() + 10000;
    loop.poke();
    loop.poke();
    await loop.run();
    assert.equal(scans, 2);
    assert.equal(loop.nextRunAt(), due);
    t.mock.timers.tick(9999);
    assert.equal(scans, 2);
    t.mock.timers.tick(1);
    await loop.run();
    assert.equal(scans, 3);
  } finally {
    await loop.stop();
  }
});

test("Request mode owns no timers and concurrent pokes during a sweep retain another pass", async () => {
  let instant = 0,
    scans = 0;

  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const loop = createWorkLoop({
    ...timing,
    resident: false,
    now: () => instant,
    onError: assert.fail,
    run: async () => {
      scans++;
      await gate;
      return null;
    },
  });

  const first = loop.run();
  loop.poke();
  loop.poke();
  assert.equal(loop.run(), first);
  release();
  await first;
  assert.equal(scans, 1);
  assert.equal(loop.nextRunAt(), 2000);
  instant = 240000;
  assert.equal(scans, 1);
  await loop.run();
  assert.equal(scans, 2);
  await loop.stop();
  loop.poke();
  await loop.run();
  assert.equal(scans, 2);
});

test("A database outage backs off and signed poke floods cannot bypass failure delay", async () => {
  let instant = 0,
    scans = 0;

  const loop = createWorkLoop({
    ...timing,
    resident: false,
    now: () => instant,
    onError: () => {},
    run: async () => {
      scans++;
      throw new Error("unavailable");
    },
  });

  await assert.rejects(loop.run());
  assert.equal(loop.nextRunAt(), 2000);
  instant = 1000;
  for (let i = 0; i < 100; i++) {
    loop.poke();
    await loop.run();
  }

  assert.equal(scans, 1);
  instant = 2000;
  await assert.rejects(loop.run());
  assert.equal(loop.nextRunAt(), 6000);
  await loop.stop();
});

test("Scheduling bounds and wake destinations fail closed", () => {
  for (const config of [
    { WORK_RECOVERY_MIN_MS: "120000", WORK_RECOVERY_MAX_MS: "60000" },
    { HOUSEKEEPING_MIN_MS: "120000", HOUSEKEEPING_MAX_MS: "60000" },
    { WORKER_WAKE_URL: "http://127.0.0.1:3001/wake" },
    {
      WORKER_WAKE_URL: "https://example.invalid/wake?job=erase",
      WORKER_WAKE_SECRET: "a".repeat(64),
    },
    {
      WORKER_WAKE_SECRET: "a".repeat(64),
      MAINTENANCE_WAKE_SECRET: "a".repeat(64),
    },
    { DB_POOL_MAX: "500" },
  ])
    assert.throws(() => parseServerConfig(config));
});
