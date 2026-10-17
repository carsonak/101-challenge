/** @file Verify the referenced YAML bundle resolves and still describes the runtime command registries. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  trackerCommandSchema,
  authCommandSchema,
} from "../packages/contracts/src/index.js";

/** Traverse union alternatives to find every discriminator without relying on file layout. */
function discriminators(value: unknown, key: string): Set<string> {
  const result = new Set<string>();
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;

    const record = node as {
      properties?: Record<string, { const?: unknown }>;
      anyOf?: unknown[];
      oneOf?: unknown[];
    };

    const name = record.properties?.[key]?.const;
    if (typeof name === "string") result.add(name);

    for (const alternative of [
      ...(record.anyOf ?? []),
      ...(record.oneOf ?? []),
    ])
      visit(alternative);
  }

  visit(value);
  return result;
}

/** Read nested runtime union alternatives, including multi-shape grant commands. */
function runtimeDiscriminators(schema: unknown, key: string): Set<string> {
  const result = new Set<string>();
  function visit(node: unknown) {
    const value = node as {
      options?: unknown[];
      shape?: Record<string, { value?: unknown }>;
    };

    const name = value.shape?.[key]?.value;
    if (typeof name === "string") result.add(name);

    for (const option of value.options ?? []) visit(option);
  }

  visit(schema);
  return result;
}

test("modular YAML resolves, preserves command alternatives and documents stale-session bootstrap", async () => {
  const directory = await mkdtemp(join(tmpdir(), "challenge-openapi-"));
  try {
    const require = createRequire(import.meta.url);
    const cli = join(
      dirname(require.resolve("@redocly/cli/package.json")),
      "bin/cli.js"
    );

    const output = join(directory, "bundle.json");
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "bundle",
        "challenge",
        "--dereferenced",
        "--ext",
        "json",
        "--output",
        output,
      ],
      { encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(await readFile(output, "utf8"));
    const tracker = document.components.schemas.TrackerCommand;
    const auth = document.components.schemas.authCommandSchema;
    assert.deepEqual(
      discriminators(tracker, "command"),
      runtimeDiscriminators(trackerCommandSchema, "command")
    );

    assert.deepEqual(
      discriminators(auth, "action"),
      runtimeDiscriminators(authCommandSchema, "action")
    );

    const session = document.paths["/api/v1/session"].get;
    assert.deepEqual(Object.keys(session.responses).sort(), ["200", "503"]);
    assert.match(session.description, /invalid.*HTTP 200/i);
    assert.match(session.description, /cookies are cleared/);
    assert.equal(document.openapi, "3.1.0");
    assert.equal(Object.keys(document.paths).length, 20);
    const ids = Object.values(document.paths).flatMap((path) =>
      Object.values(path as Record<string, { operationId?: string }>)
        .map((operation) => operation.operationId)
        .filter(Boolean)
    );

    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bundle output stays outside repositories, including hidden names and symlink targets", async () => {
  const { prepareOpenapiOutput } = await import(
    "../scripts/openapi-output.mjs" as string
  );

  const directory = await mkdtemp(join(tmpdir(), "challenge-api-output-"));
  try {
    const checkout = join(directory, "checkout");
    await mkdir(join(checkout, ".git"), { recursive: true });
    await assert.rejects(
      prepareOpenapiOutput(join(checkout, "..hidden", "api.yaml")),
      /outside repositories/
    );

    const link = join(directory, "linked");
    await symlink(checkout, link, "dir");
    await assert.rejects(
      prepareOpenapiOutput(join(link, "api.yaml")),
      /outside repositories/
    );

    const output = join(directory, "artifacts", "api.yaml");
    assert.equal(await prepareOpenapiOutput(output), output);
    await assert.rejects(prepareOpenapiOutput("relative.yaml"), /absolute/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
