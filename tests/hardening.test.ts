/** @file Verify migration registry and documentation/parser regressions without live services. */
import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import {
  trackerMigrations,
  requireMigrations,
} from "../packages/db/src/migrations.js";

test("migration registry exactly matches ordered files and gates readiness", async () => {
  const files = (
    await readdir(new URL("../packages/db/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort();

  assert.deepEqual(
    trackerMigrations.map(([, file]) => file),
    files
  );

  assert.equal(
    new Set(trackerMigrations.map(([version]) => version)).size,
    files.length
  );

  await requireMigrations({
    query: async () => ({ rowCount: files.length }),
  } as never);

  await assert.rejects(
    requireMigrations({
      query: async () => ({ rowCount: files.length - 1 }),
    } as never),
    { code: "MIGRATIONS_REQUIRED" }
  );
});

test("Markdown file references distinguish links, definitions and code", async () => {
  // The script is intentionally native JS and has no declaration dependency.
  const { markdownLinks } = await import(
    "../scripts/markdown-links.mjs" as string
  );

  assert.deepEqual(markdownLinks("[broken.md]").malformed, ["broken.md"]);
  assert.deepEqual(
    markdownLinks(
      "[ok.md](ok.md)\n[other.md][ref]\n[ref]: other.md\n`[code.md]`\n```md\n[example.md]\n```"
    ).malformed,
    []
  );
});

test("test-runner enumerates named failures and returns a nonzero exit locally and in CI", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "challenge-runner-"));
  try {
    const file = join(directory, "failure.test.mjs");
    await writeFile(
      file,
      'import test from "node:test"; import assert from "node:assert/strict"; test("intentional sentinel failure", () => assert.fail("sentinel"));'
    );

    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ["--test", "--test-isolation=none", file],
      { encoding: "utf8", env: childEnvironment }
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /intentional sentinel failure/);
    assert.match(result.stdout + result.stderr, /fail 1/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("action buckets are independent, storage is bounded, and cooldown expiry uses the injected clock", async () => {
  const { createThrottle } = await import("../packages/core/src/throttle.js");
  let instant = 0;
  const limiter = createThrottle(() => instant, 2);
  limiter.take("login", "person", 1, 1000);
  limiter.take("recovery", "person", 1, 1000);
  assert.throws(() => limiter.take("login", "person", 1, 1000), {
    code: "RATE_LIMITED",
    retryAfter: 1,
  });

  assert.throws(() => limiter.take("login", "different", 1, 1000), {
    code: "RATE_LIMITED",
  });

  instant = 1000;
  assert.equal(
    limiter.allow("verification", "normalized@example.test", 1000),
    true
  );

  assert.equal(
    limiter.allow("verification", "normalized@example.test", 1000),
    false
  );

  instant = 2000;
  assert.equal(
    limiter.allow("verification", "normalized@example.test", 1000),
    true
  );
});

test("hash capacity rejects saturation and releases slots after errors without overlapping work", async () => {
  const { createCapacity } = await import("../packages/core/src/capacity.js");
  const capacity = createCapacity(1, 1);
  let release: (() => void) | undefined;
  let active = 0,
    maximum = 0;

  const first = capacity.run(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise<void>((resolve) => {
      release = resolve;
    });

    active--;
    throw new Error("fixture");
  });

  const firstFailure = assert.rejects(first, /fixture/);
  const second = capacity.run(async () => {
    active++;
    maximum = Math.max(maximum, active);
    active--;
    return "released";
  });

  await assert.rejects(
    capacity.run(async () => "overflow"),
    { code: "RATE_LIMITED" }
  );

  assert.ok(release);
  release();
  await firstFailure;
  assert.equal(await second, "released");
  assert.equal(maximum, 1);
  assert.equal(await capacity.run(async () => "reused"), "reused");
});

test("Discord payload limits reject oversized fields and deadline timeouts never mutate", async () => {
  const { createDiscordAdapter, validateDiscordPayload } =
    await import("../apps/web/server/discord.js");

  assert.throws(() =>
    validateDiscordPayload({ type: 4, data: { content: "x".repeat(2001) } })
  );

  assert.throws(() =>
    validateDiscordPayload({
      type: 9,
      data: {
        title: "Fixture",
        custom_id: "x",
        components: Array.from({ length: 6 }, () => ({ type: 18 })),
      },
    })
  );

  const { generateKeyPairSync, sign } = await import("node:crypto");
  const keys = generateKeyPairSync("ed25519");
  let mutations = 0,
    scheduled = 0;

  const deps = {
    publicKey: keys.publicKey
      .export({ format: "der", type: "spki" })
      .subarray(-32)
      .toString("hex"),
    origin: "http://localhost:3000",
    auth: {
      discordActor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2200));
        return "fixture";
      },
    },
    tracker: {
      dailySummary: async () => [],
      execute: async () => {
        mutations++;
      },
    },
    database: {},
    schedule: () => {
      scheduled++;
    },
    deliver: async () => {},
  };

  const adapter = createDiscordAdapter(
    deps as unknown as Parameters<typeof createDiscordAdapter>[0]
  );

  const body = JSON.stringify({
    type: 2,
    id: "1",
    application_id: "2",
    guild_id: "3",
    token: "fixture",
    member: { user: { id: "4" } },
    data: { name: "report" },
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const before = performance.now();
  const response = await adapter.handle(
    new Request("http://localhost:3000/api/discord", {
      method: "POST",
      headers: {
        "x-signature-timestamp": timestamp,
        "x-signature-ed25519": sign(
          null,
          Buffer.from(timestamp + body),
          keys.privateKey
        ).toString("hex"),
      },
      body,
    })
  );

  assert.ok(performance.now() - before < 2150);
  assert.match(
    (await response.json()).data.content,
    /service may be waking up/
  );

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(mutations, 0);
  assert.equal(scheduled, 0);
});

test("OAuth failure redirects require bound linking state and never reflect provider text", async () => {
  const { createWebApi } = await import("../apps/web/server/api.js");
  const { parseServerConfig } =
    await import("../packages/contracts/src/index.js");

  const config = parseServerConfig({ APP_ORIGIN: "http://localhost:3000" });
  for (const mode of ["invalid", "login", "link"]) {
    const api = createWebApi({
      config,
      auth: {
        oauthState: async () => {
          if (mode === "invalid") throw new Error("private provider error");

          return { userId: mode === "link" ? "fictional" : null };
        },
      } as never,
      tracker: {} as never,
      providers: {} as never,
    });

    const response = await api.handle(
      new Request(
        "http://localhost:3000/api/auth/google/callback?state=fixture&error=provider_private_text",
        { headers: { cookie: "challenge_oauth=fixture" } }
      )
    );

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      `http://localhost:3000/${mode === "link" ? "account" : "login"}?error=oauth`
    );

    assert.match(
      response.headers.get("set-cookie") ?? "",
      /challenge_oauth=;.*Max-Age=0/
    );

    assert.ok(response.headers.has("x-request-id"));
    assert.equal(
      (await response.text()).includes("provider_private_text"),
      false
    );
  }
});

test("forwarded-address spoofing cannot evade default action limits; independent actions remain usable", async () => {
  const { createWebApi } = await import("../apps/web/server/api.js");
  const { parseServerConfig } =
    await import("../packages/contracts/src/index.js");

  const api = createWebApi({
    config: parseServerConfig({ APP_ORIGIN: "http://localhost:3000" }),
    auth: { execute: async () => ({ accepted: true }) } as never,
    tracker: {} as never,
    providers: {} as never,
    now: () => 0,
  });

  const invoke = (action: string, n: number) =>
    api.handle(
      new Request("http://localhost:3000/api/v1/auth", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": `198.51.100.${n}`,
        },
        body: JSON.stringify({
          action,
          email: `fictional-${n}@example.test`,
          ...(action === "login" ? { password: "fictional password" } : {}),
        }),
      })
    );

  for (let n = 0; n < 20; n++)
    assert.equal((await invoke("login", n)).status, 200);

  const blocked = await invoke("login", 21);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal((await invoke("recover", 22)).status, 200);
});

test("recovery splitting preserves emoji and escaping units", async () => {
  const { recoveryChunks } = await import("../apps/web/server/discord.js");
  const chunks = recoveryChunks("🙂".repeat(2000));
  assert.equal(chunks.join(""), "🙂".repeat(2000));
  assert.ok(chunks.every((c) => c.length <= 1800));
});
