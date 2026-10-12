/** @file Validate the active Node version against package.json before local commands load application code. Importing performs no checks. */
import { readFileSync } from "node:fs";

/** Reject unsupported Node versions with instructions for selecting the repository runtime. */
export function assertSupportedRuntime(version = process.versions.node) {
  const { engines } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );
  const range = /^>=(\d+)\.(\d+)\.(\d+) <(\d+)$/.exec(engines.node);
  if (!range) throw new Error("Unsupported Node engine range in package.json");
  const [major, minor, patch] = version.split(".").map(Number);
  const minimum = range.slice(1, 4).map(Number);
  const supported =
    major < Number(range[4]) &&
    (major > minimum[0] ||
      (major === minimum[0] &&
        (minor > minimum[1] || (minor === minimum[1] && patch >= minimum[2]))));
  if (!supported)
    throw Object.assign(
      new Error(
        `Node ${version} is unsupported; this project requires ${engines.node}. ` +
          "Select Node 24 before running pnpm (for example: mise exec node@24 -- pnpm dev:worker, or nvm use)."
      ),
      { code: "UNSUPPORTED_NODE" }
    );
}
