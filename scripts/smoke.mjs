import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { once } from "node:events";

// Use independent ephemeral ports; the caller supplies an isolated disposable DB.
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url)
);
const ports = [await freePort(), await freePort()];
const children = [];
let output = "";
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  children.push(child);
  return child;
}
async function get(port, path) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(5000),
  });
}
async function waitFor(port, path, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error("Smoke process exited before readiness");
    try {
      const response = await get(port, path);
      if (response.ok) return;
    } catch {
      /* still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Smoke startup timeout");
}
try {
  const web = start(
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(ports[0]),
    ],
    new URL("../apps/web", import.meta.url),
    { APP_DISPLAY_NAME: "Fictional Community Challenge" }
  );
  const worker = start(
    ["apps/worker/dist/index.js"],
    new URL("..", import.meta.url),
    {
      WORKER_PORT: String(ports[1]),
      WORKER_HOST: "127.0.0.1",
      QUEUE_SCHEMA: process.env.QUEUE_SCHEMA ?? "pgboss_smoke",
    }
  );
  await Promise.all([
    waitFor(ports[0], "/api/health", web),
    waitFor(ports[1], "/health", worker),
  ]);
  assert.deepEqual(await (await get(ports[0], "/api/health")).json(), {
    status: "ok",
    service: "web",
  });
  assert.deepEqual(await (await get(ports[1], "/health")).json(), {
    status: "ok",
    service: "worker",
  });
  const page = await (await get(ports[0], "/")).text();
  assert.ok(page.includes("Fictional Community Challenge"));
  assert.ok(!page.includes("GOOGLE_CLIENT_SECRET"));
  for (const [index, path] of [
    [0, "/api/ready"],
    [1, "/ready"],
  ]) {
    const result = await get(ports[index], path);
    assert.equal(result.status, process.env.DATABASE_URL ? 200 : 503);
    assert.equal(
      (await result.json()).status,
      process.env.DATABASE_URL ? "ok" : "unavailable"
    );
  }
  console.info(
    `Web/worker smoke passed (${process.env.DATABASE_URL ? "database connected" : "unconfigured database correctly unavailable"})`
  );
} catch (error) {
  // Child errors are designed to be redacted; never print environment variables.
  console.error(output);
  throw error;
} finally {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 12000);
      await exited;
      clearTimeout(timeout);
    })
  );
}
