/** @file Verify the temporary Discord tunnel boundary with synthetic signed bytes on loopback only. */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("Discord proxy forwards exact POST bytes and signatures, rejecting other methods, queries and paths", async () => {
  const seen: {
    body: Buffer;
    path: string;
    signature: unknown;
    authorization: unknown;
  }[] = [];

  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of req) chunks.push(chunk);
    } catch {
      return;
    }

    seen.push({
      body: Buffer.concat(chunks),
      path: req.url ?? "",
      signature: req.headers["x-signature-ed25519"],
      authorization: req.headers.authorization,
    });

    res.writeHead(200).end('{"type":1}');
  });

  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress !== "string");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const child = spawn(process.execPath, ["scripts/discord-proxy.mjs"], {
    env: {
      ...process.env,
      DISCORD_PROXY_TARGET: `http://127.0.0.1:${upstreamAddress.port}`,
      DISCORD_PROXY_PORT: String(address.port),
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (let n = 0; n < 30; n++) {
      try {
        await fetch(origin);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const bytes = Buffer.from(' { "type": 1, "text": "日🙂" }\n');
    const response = await fetch(`${origin}/api/discord`, {
      method: "POST",
      body: bytes,
      headers: {
        "x-signature-ed25519": "fictional-signature",
        "x-signature-timestamp": "123",
        authorization: "must-not-forward",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(seen[0].body, bytes);
    assert.equal(seen[0].signature, "fictional-signature");
    assert.equal(seen[0].authorization, undefined);
    for (const path of [
      "/",
      "/api/v1/session",
      "/api/discord?secret=fictional",
      "/api/discord/",
      "//api/discord",
      "/api/auth/discord/callback",
    ]) {
      assert.equal(
        (await fetch(origin + path, { method: "POST", body: "fixture" }))
          .status,
        404
      );
    }

    assert.equal((await fetch(`${origin}/api/discord`)).status, 404);
    assert.equal(seen.length, 1);
    assert.equal(
      (
        await fetch(`${origin}/api/discord`, {
          method: "POST",
          body: "x".repeat(65537),
        })
      ).status,
      413
    );
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
