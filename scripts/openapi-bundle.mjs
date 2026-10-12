/** @file Bundle the referenced API as YAML to an explicitly supplied external output. Run pnpm openapi:bundle --output /absolute/external/openapi.yaml. */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { prepareOpenapiOutput } from "./openapi-output.mjs";
import { fileURLToPath } from "node:url";

/** Repository root owns the source specification, never generated bundles. */
const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--output")
  throw new Error("Supply --output with an absolute external .yaml path");
const output = await prepareOpenapiOutput(args[1]);
/** Pinned CLI executable, resolved from the installed workspace tooling. */
const require = createRequire(import.meta.url);
const cli = resolve(
  dirname(require.resolve("@redocly/cli/package.json")),
  "bin/cli.js"
);
const child = spawn(
  process.execPath,
  [cli, "bundle", "challenge", "--output", output],
  { cwd: root, stdio: "inherit" }
);
child.once("error", (error) => {
  throw error;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
