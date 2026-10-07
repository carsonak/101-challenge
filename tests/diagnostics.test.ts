/** @file Verifies backend diagnostics cannot serialize private requests while preserving operator exception details. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnosticRoute,
  logBackend,
} from "../packages/core/src/diagnostics.js";
import { observeRequest } from "../apps/web/server/logging.js";
import { createWebApi, type ApiDependencies } from "../apps/web/server/api.js";
import { parseServerConfig } from "../packages/contracts/src/index.js";
import { createMailer } from "../apps/web/server/mail.js";

/** Assert a synthetic diagnostic exists before inspecting it. */
function required<T>(value: T | null | undefined): T {
  assert.ok(value != null);
  return value;
}

test("Diagnostics allowlist routes, metadata and error codes without serializing secrets", () => {
  const lines: string[] = [];
  const secret = "private@example.test password proof cookie report SQL seed";
  const error = Object.assign(new Error(secret), {
    code: "23503",
    detail: secret,
    query: secret,
    cause: new Error(secret),
    toJSON() {
      throw new Error("Errors must never be serialized");
    },
  });
  logBackend(
    "web",
    "http_request",
    {
      route: "/api/v1/auth",
      method: "POST",
      status: 503,
      durationMs: 12.4,
      ...{ body: secret, cookie: secret, requestId: secret },
    },
    error,
    (line) => lines.push(line)
  );
  const record = JSON.parse(required(lines[0]));
  assert.equal(record.errorCode, "23503");
  assert.equal(record.level, "error");
  assert.equal(record.durationMs, 12);
  assert.equal(record.requestId, undefined);
  assert.ok(!lines.join().includes(secret));
  assert.equal(
    diagnosticRoute(
      `https://example.test/api/auth/google/callback?code=${secret}`
    ),
    "/api/auth/google/callback"
  );
  assert.equal(diagnosticRoute(`https://example.test/${secret}`), "unmatched");
  logBackend(
    "worker",
    "queue_failed",
    {},
    { code: secret, name: secret },
    (line) => lines.push(line)
  );
  assert.equal(JSON.parse(required(lines[1])).errorCode, "INTERNAL");
  assert.ok(!lines.join().includes(secret));
  assert.doesNotThrow(() =>
    logBackend("worker", "listening", {}, undefined, () => {
      throw error;
    })
  );
});

test("HTTP diagnostics correlate safe client errors and never trust a supplied request ID", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "warn", (line: string) => lines.push(line));
  const response = await observeRequest(
    new Request("http://localhost/api/v1/auth?token=private-proof", {
      method: "POST",
      headers: { "x-request-id": "private-cookie" },
      body: "private report",
    }),
    async (recordError) => {
      recordError({ code: "FORBIDDEN", message: "private@example.test" });
      return Response.json({ code: "FORBIDDEN" }, { status: 403 });
    }
  );
  assert.equal(response.status, 403);
  const id = response.headers.get("x-request-id");
  assert.match(required(id), /^[a-f0-9-]{36}$/);
  const record = JSON.parse(required(lines[0]));
  assert.equal(record.requestId, id);
  assert.equal(record.errorCode, "FORBIDDEN");
  assert.equal(record.level, "warn");
  assert.ok(!lines.join().includes("private"));
});

test("SMTP failure logs its safe code while preserving enumeration-safe caller handling", async (t) => {
  const lines: string[] = [];
  const secret = "private@example.test proof-token message content";
  const failure = Object.assign(new Error(secret), { code: "ECONNREFUSED" });
  t.mock.method(console, "error", (line: string) => lines.push(line));
  const mailer = createMailer(parseServerConfig({}), {
    async sendMail() {
      throw failure;
    },
    close() {},
  });
  try {
    await assert.rejects(
      mailer.send({
        kind: "verify",
        recipient: "private@example.test",
        token: "proof-token",
      }),
      failure
    );
    const record = JSON.parse(required(lines[0]));
    assert.equal(record.event, "mail_failed");
    assert.equal(record.errorCode, "ECONNREFUSED");
    assert.ok(!lines.join().includes("private@example.test"));
    assert.ok(!lines.join().includes("proof-token"));
  } finally {
    mailer.close();
  }
});

test("Unexpected API database errors produce a correlated 503 diagnostic and safe response", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: string) => lines.push(line));
  const config = parseServerConfig({});
  const api = createWebApi({
    config,
    tracker: {
      async seasons() {
        throw Object.assign(new Error("private SQL and report"), {
          code: "42P01",
        });
      },
    },
    auth: {},
    providers: {},
  } as unknown as ApiDependencies);
  const response = await api.handle(
    new Request("http://localhost/api/v1/seasons")
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Service unavailable" });
  const record = JSON.parse(required(lines[0]));
  assert.equal(record.errorCode, "42P01");
  assert.equal(record.requestId, response.headers.get("x-request-id"));
  assert.equal(record.route, "/api/v1/seasons");
  assert.equal(record.error.message, "private SQL and report");
  assert.match(record.error.stack, /diagnostics.test/);
});

test("Startup diagnostics expose nested failures and safe recovery hints", () => {
  const secret = "postgres://private:password@example.test/private";
  const connection = Object.assign(new Error(secret), { code: "ECONNREFUSED" });
  const errors: unknown[] = [connection];
  const aggregate = new AggregateError(errors, secret);
  errors.push(aggregate);
  const lines: string[] = [];
  logBackend(
    "worker",
    "startup_failed",
    { stage: "database_readiness" },
    new Error(secret, { cause: aggregate }),
    (line) => lines.push(line)
  );
  const record = JSON.parse(required(lines[0]));
  assert.equal(record.errorCode, "ECONNREFUSED");
  assert.equal(record.stage, "database_readiness");
  assert.match(record.hint, /pnpm services:up/);
  assert.ok(!lines.join().includes(secret));
  logBackend(
    "worker",
    "startup_failed",
    { stage: "database_readiness" },
    { code: "MIGRATIONS_REQUIRED" },
    (line) => lines.push(line)
  );
  assert.match(JSON.parse(required(lines[1])).hint, /pnpm database:migrate/);
});

test("Operator diagnostics preserve messages, custom codes, causes and stacks", () => {
  const lines: string[] = [];
  const cause = Object.assign(new Error("Queue schema initialization failed"), {
    code: "CUSTOM_QUEUE_CODE",
  });
  const error = new Error("Cannot start worker", { cause });
  logBackend("worker", "startup_failed", {}, error, (line) => lines.push(line));
  const record = JSON.parse(required(lines[0]));
  assert.equal(record.error.message, error.message);
  assert.equal(record.error.stack, error.stack);
  assert.equal(record.error.cause.message, cause.message);
  assert.equal(record.error.cause.code, "CUSTOM_QUEUE_CODE");
});
