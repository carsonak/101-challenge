/**
 * @file Checks local Markdown link targets and the fictional seed fixture's expected hashes.
 * Run `pnpm docs:check` from the repository root when changing documentation or fixtures.
 * Reads files and exits unsuccessfully on invalid links or fixture mismatches; does not write files.
 * Runs immediately when executed or imported.
 */

import { readdir, readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash, createHmac } from "node:crypto";
import assert from "node:assert/strict";

/** Directories excluded from documentation discovery. */
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  ".pnpm-store",
]);
/** Collect absolute Markdown paths beneath a directory, excluding ignored directories. */
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}
/** Missing local link targets collected for a single failure report. */
const errors = [];
for (const file of await walk(".")) {
  const body = await readFile(file, "utf8");
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    try {
      await access(resolve(dirname(file), decodeURIComponent(target)));
    } catch {
      errors.push(`${file}: missing ${target}`);
    }
  }
}
/**
 * Prepare a fixture value for stable JSON serialization by ordering object keys.
 * Preserves array order and primitive values without modifying the input.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}
/** Fictional seed inputs and expected results used to verify the documented contract. */
const fixture = JSON.parse(
  await readFile("plans/artwork-generator/fixtures/base-seed-v1.json", "utf8")
);
/** Stable JSON text compared with the fixture and used for its hash checks. */
const serialized = JSON.stringify(canonical(fixture.initial));
assert.equal(serialized, fixture.canonicalInitialJSON);
assert.equal(
  createHash("sha256").update(serialized).digest("hex"),
  fixture.initialInputDigest
);
assert.equal(
  createHmac("sha256", Buffer.from(fixture.seasonSeed, "hex"))
    .update(`attempt-v1\n${serialized}`)
    .digest("hex"),
  fixture.baseSeed
);
if (errors.length) throw new Error(errors.join("\n"));
console.info("Documentation links and fictional seed vector verified");
