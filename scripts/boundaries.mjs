/**
 * @file Checks application/package sources and manifests for forbidden dependencies.
 * Run `pnpm lint` from the repository root to check architectural boundaries.
 * Reads files and reports violations with a failing exit status; does not change files.
 * Runs immediately when executed or imported.
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Collect absolute source and manifest paths beneath a directory for boundary checks. */
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".next"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (
      /\.[cm]?[jt]sx?$/.test(entry.name) ||
      entry.name === "package.json"
    )
      files.push(path);
  }
  return files;
}
/** Boundary violations collected for a single failure report. */
const errors = [];
for (const root of ["apps", "packages"]) {
  for (const file of await walk(root)) {
    const text = await readFile(file, "utf8");
    if (
      file.includes("/packages/core/") ||
      file.includes("/packages/contracts/")
    ) {
      if (
        /['"](?:next(?:\/[^'"]*)?|react(?:-dom)?|discord[^'"]*|pg(?:-boss)?|drizzle-orm[^'"]*|@challenge\/(?:db|web|worker))['"]/.test(
          text
        )
      )
        errors.push(`${file}: forbidden domain dependency`);
    }
    if (
      /(?:from\s*|import\s*\(|require\s*\()['"][^'"]*(?:artwork|renderer|resvg)/i.test(
        text
      ) ||
      /['"](?:@challenge\/artwork[^'"]*|@resvg\/[^'"]*)['"]/.test(text)
    )
      errors.push(`${file}: artwork runtime in tracker foundation`);
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.info("Tracker package boundaries verified");
