/**
 * @file Launches the web application in development or production mode.
 * Run `pnpm dev:web` or, after building, `pnpm start:web` from the repository root.
 * These commands load the root .env; the launcher passes its inherited environment
 * to the application and listens on all interfaces at PORT (default 3000).
 * Starts a long-lived child process, forwards terminal output and termination
 * signals, and propagates the child's exit code. Direct execution accepts `dev`
 * or `start` as its first argument and defaults to development mode.
 * Runs immediately when executed or imported.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Resolves the web application's installed launcher dependency. */
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url)
);
/** Web process whose output, termination signals and exit status are forwarded. */
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    process.argv[2] ?? "dev",
    "--port",
    process.env.PORT ?? "3000",
    "--hostname",
    "0.0.0.0",
  ],
  {
    cwd: fileURLToPath(new URL("../apps/web", import.meta.url)),
    stdio: "inherit",
    env: process.env,
  }
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Web process failed to start");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
