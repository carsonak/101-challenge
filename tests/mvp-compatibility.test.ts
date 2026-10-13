/** @file Freeze the reviewed MVP migration history while allowing new migrations to be appended. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trackerMigrations } from "../packages/db/src/migrations.js";

test("MVP migration versions, order and contents remain immutable; upgrades append new files", async () => {
  const baseline: { version: number; file: string; sha256: string }[] =
    JSON.parse(
      await readFile(
        new URL("./fixtures/mvp-migrations.json", import.meta.url),
        "utf8"
      )
    );

  assert.deepEqual(
    trackerMigrations.slice(0, baseline.length),
    baseline.map(({ version, file }) => [version, file])
  );

  for (const entry of baseline) {
    const sql = await readFile(
      new URL(`../packages/db/migrations/${entry.file}`, import.meta.url)
    );

    assert.equal(
      createHash("sha256").update(sql).digest("hex"),
      entry.sha256,
      `Applied migration ${entry.file} changed; append a migration instead`
    );
  }
});
