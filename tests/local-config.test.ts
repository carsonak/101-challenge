/** @file Local setup checks credential scoping, example drift and actionable redacted CLI failures. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { serverConfigKeys } from "../packages/contracts/src/index.js";

/** Native setup helpers are tested through their public interfaces. */
const { localEnvironment, runtimeKeys, operatorKeys, readLocalSettings } =
  await import("../scripts/local-env.mjs" as string);

test("local launchers require the Node engine range before loading application code", async () => {
  const { assertSupportedRuntime } = await import(
    "../scripts/runtime.mjs" as string
  );

  for (const version of ["24.7.0", "24.20.0"])
    assert.doesNotThrow(() => assertSupportedRuntime(version));

  for (const version of ["22.15.0", "24.6.9", "25.0.0"])
    assert.throws(() => assertSupportedRuntime(version), {
      code: "UNSUPPORTED_NODE",
    });
});

test("local examples cover the complete inventory and use consistent fictional restricted logins", async () => {
  const runtime = parseEnv(
    await readFile(new URL("../.env.example", import.meta.url), "utf8")
  );

  const operator = parseEnv(
    await readFile(new URL("../.env.operator.example", import.meta.url), "utf8")
  );

  assert.deepEqual(Object.keys(runtime).sort(), [...runtimeKeys].sort());
  assert.deepEqual(Object.keys(operator).sort(), [...operatorKeys].sort());
  for (const key of serverConfigKeys)
    assert.ok(runtimeKeys.includes(key), `Missing server setting: ${key}`);

  for (const [urlKey, role] of [
    ["DATABASE_URL", "WEB"],
    ["WORKER_DATABASE_URL", "WORKER"],
    ["MIGRATOR_DATABASE_URL", "MIGRATOR"],
    ["ERASURE_DATABASE_URL", "MAINTENANCE"],
  ]) {
    const url = new URL(runtime[urlKey] ?? operator[urlKey]);
    assert.equal(url.username, operator[`${role}_DB_USER`]);
    assert.equal(url.password, operator[`${role}_DB_PASSWORD`]);
  }
});

test("two-file launch scopes reject credential crossover including inherited operator secrets", () => {
  const runtime = {
    DATABASE_URL: "web-fixture",
    WORKER_DATABASE_URL: "worker-fixture",
    APP_ORIGIN: "http://localhost:4173",
    SMTP_PASSWORD: "smtp-fixture",
    GOOGLE_CLIENT_SECRET: "google-fixture",
    DISCORD_CLIENT_ID: "application-fixture",
  };

  const operator = Object.fromEntries(
    operatorKeys.map((key: string) => [key, `private-${key}`])
  );

  const inherited = {
    ...operator,
    HOME: "/synthetic-home",
    APP_ORIGIN: "http://localhost:4174",
  };

  const web = localEnvironment("web", runtime, operator, inherited);
  assert.equal(web.DATABASE_URL, "web-fixture");
  assert.equal(web.WORKER_DATABASE_URL, undefined);
  assert.equal(web.APP_ORIGIN, inherited.APP_ORIGIN);
  assert.equal(web.HOME, inherited.HOME);
  for (const key of operatorKeys) assert.equal(web[key], undefined, key);

  const worker = localEnvironment("worker", runtime, operator, inherited);
  assert.equal(worker.DATABASE_URL, "worker-fixture");
  assert.equal(worker.GOOGLE_CLIENT_SECRET, undefined);
  assert.equal(worker.SMTP_PASSWORD, undefined);
  for (const key of operatorKeys) assert.equal(worker[key], undefined, key);

  assert.equal(
    localEnvironment("migrate", runtime, operator, {}).DATABASE_URL,
    operator.MIGRATOR_DATABASE_URL
  );

  const maintenance = localEnvironment(
    "maintain",
    runtime,
    operator,
    inherited
  );

  assert.equal(maintenance.ERASURE_DATABASE_URL, operator.ERASURE_DATABASE_URL);
  assert.equal(maintenance.SMTP_PASSWORD, runtime.SMTP_PASSWORD);
  assert.equal(maintenance.OPERATOR_DATABASE_URL, undefined);
  assert.equal(maintenance.DATABASE_URL, undefined);
  const register = localEnvironment("register", runtime, operator, inherited);
  assert.equal(register.DISCORD_BOT_TOKEN, operator.DISCORD_BOT_TOKEN);
  assert.equal(register.DISCORD_CLIENT_ID, runtime.DISCORD_CLIENT_ID);
  assert.equal(register.OPERATOR_DATABASE_URL, undefined);
  const proxy = localEnvironment("proxy", runtime, operator, inherited);
  assert.deepEqual(Object.keys(proxy).sort(), ["DISCORD_PROXY_TARGET", "HOME"]);
  assert.equal(proxy.DISCORD_PROXY_TARGET, inherited.APP_ORIGIN);
  assert.throws(
    () => localEnvironment("worker", { DATABASE_URL: "web" }, {}, {}),
    /WORKER_DATABASE_URL/
  );

  assert.throws(
    () => localEnvironment("migrate", { DATABASE_URL: "web" }, {}, {}),
    /MIGRATOR_DATABASE_URL/
  );

  assert.throws(
    () => localEnvironment("unknown", {}, {}, {}),
    /Unknown local command/
  );
});

test("optional files do not mask real file-access errors", async () => {
  assert.deepEqual(
    await readLocalSettings(
      new URL("./absent-config-fixture", import.meta.url)
    ),
    {}
  );

  await assert.rejects(
    readLocalSettings(new URL("../scripts/", import.meta.url)),
    { code: "EISDIR" }
  );
});

test("CLI diagnostics preserve codes, nested causes and stack while redacting secrets and SQL properties", async () => {
  const { reportCliFailure } = await import(
    "../scripts/cli-diagnostics.mjs" as string
  );

  const previous = process.env.DISCORD_BOT_TOKEN;
  const previousFormat = process.env.LOG_FORMAT;
  const secret = "fictional-private-bot-token";
  process.env.DISCORD_BOT_TOKEN = secret;
  process.env.LOG_FORMAT = "pretty";
  try {
    const lines: string[] = [];
    const cause = Object.assign(
      new Error(
        `connect postgres://owner:password@localhost/db?token=${secret}`
      ),
      { code: "ECONNREFUSED", query: "private SQL", detail: "private SQL" }
    );

    const failure = new Error(`failed using ${secret}`, {
      cause: new AggregateError([cause], "database connections refused"),
    });

    reportCliFailure("database:migrate", failure, undefined, (line: string) =>
      lines.push(line)
    );

    const output = lines.join("\n");
    assert.match(output, /database:migrate.*ECONNREFUSED/);
    assert.match(output, /database connections refused/);
    assert.match(output, /\n\s+at /);
    assert.match(output, /Caused by:/);
    assert.match(output, /Next: Check PostgreSQL is running/);
    for (const value of [secret, "owner:password", "private SQL"])
      assert.equal(output.includes(value), false);

    process.env.LOG_FORMAT = "json";
    const json: string[] = [];
    reportCliFailure("database:migrate", failure, undefined, (line: string) =>
      json.push(line)
    );

    assert.equal(json.length, 1);
    const parsed = JSON.parse(json[0] as string);
    assert.equal(parsed.operation, "database:migrate");
    assert.equal(parsed.errorCode, "ECONNREFUSED");
    assert.match(parsed.error.stack, /local-config.test/);
    assert.equal(json[0]?.includes(secret), false);
  } finally {
    if (previous === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = previous;

    if (previousFormat === undefined) delete process.env.LOG_FORMAT;
    else process.env.LOG_FORMAT = previousFormat;
  }
});
