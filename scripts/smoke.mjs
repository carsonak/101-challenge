/**
 * @file Verifies the built web and worker services, branding, liveness and readiness.
 * Run `pnpm smoke` from the repository root after `pnpm build`. When DATABASE_URL
 * is configured, it must point to an isolated disposable database: worker startup
 * can initialize queue tables. Without it, the checks expect unavailable readiness.
 * Starts temporary loopback servers, inherits server configuration, and stops child
 * services on success or failure. Prints captured service output on failure and
 * exits unsuccessfully if a check fails. Database changes are not rolled back.
 * Runs immediately when executed or imported.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";

/** Starting test workers must never modify the owner/provider database. */
if (
  process.env.DATABASE_URL &&
  !/_(test|ci)$/.test(new URL(process.env.DATABASE_URL).pathname)
)
  throw new Error("Smoke checks require an isolated _test or _ci database");

// Use independent ephemeral ports; the caller supplies an isolated disposable DB.
/**
 * Briefly bind a loopback socket to find an available port.
 * The port is released before return, so the caller must bind it promptly.
 */
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
/** Temporary loopback ports for the web and worker smoke instances. */
const ports = [await freePort(), await freePort()];
/** Child services to stop when the smoke checks finish. */
const children = [];
/** Bounded startup allowance for slower local/CI hosts; failures are never retried. */
const startupTimeout = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS ?? 30000);
if (
  !Number.isInteger(startupTimeout) ||
  startupTimeout < 1000 ||
  startupTimeout > 300000
)
  throw new Error("SMOKE_STARTUP_TIMEOUT_MS must be between 1000 and 300000");
/** Bounded HTTP allowance; cold production routes can be slower on a busy host. */
const requestTimeout = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 5000);
if (
  !Number.isInteger(requestTimeout) ||
  requestTimeout < 1000 ||
  requestTimeout > 120000
)
  throw new Error("SMOKE_REQUEST_TIMEOUT_MS must be between 1000 and 120000");
/** Captured service output to report if a smoke check fails. */
let output = "";
/**
 * Start a Node child in the supplied directory with environment overrides.
 * Captures output and registers the child for cleanup; callers must await startup.
 */
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
/** Fetch a loopback endpoint with a bounded timeout and safe route diagnostics. */
async function get(port, path) {
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(requestTimeout),
    });
  } catch (cause) {
    throw new Error(`Smoke request failed for ${path}`, { cause });
  }
}
/** Wait for a successful HTTP response within the configured startup allowance. */
async function waitFor(port, path, child) {
  const deadline = Date.now() + startupTimeout;
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
    ["scripts/web.mjs", "start"],
    new URL("..", import.meta.url),
    {
      APP_DISPLAY_NAME: "Fictional Community Challenge",
      PORT: String(ports[0]),
      WEB_HOST: "127.0.0.1",
    }
  );
  const worker = start(
    ["apps/worker/dist/index.js"],
    new URL("..", import.meta.url),
    {
      WORKER_PORT: String(ports[1]),
      WORKER_HOST: "127.0.0.1",
      QUEUE_SCHEMA: process.env.QUEUE_SCHEMA ?? "pgboss_smoke",
      DATABASE_URL:
        process.env.SMOKE_WORKER_DATABASE_URL ?? process.env.DATABASE_URL,
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
