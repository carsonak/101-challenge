/**
 * @file Launches the web application in development or production mode.
 * Run `pnpm dev:web` or, after building, `pnpm start:web` from the repository root.
 * These commands load the root .env; the launcher passes its inherited environment
 * to the application and listens on loopback at PORT (default 3000); production containers set WEB_HOST explicitly.
 * Starts a long-lived child process, forwards terminal output and termination
 * signals, and propagates the child's exit code. Direct execution accepts `dev`
 * or `start` as its first argument and defaults to development mode.
 * Runs immediately when executed or imported.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reportCliFailure } from "./cli-diagnostics.mjs";

/** Resolves the web application's installed launcher dependency. */
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url)
);
/** Production uses the self-contained output; development uses Next's CLI. */
const production = process.argv[2] === "start";
/** Web process whose output, termination signals and exit status are forwarded. */
const child = spawn(
  process.execPath,
  production
    ? [
        fileURLToPath(
          new URL(
            "../apps/web/.next/standalone/apps/web/server.js",
            import.meta.url
          )
        ),
      ]
    : [
        require.resolve("next/dist/bin/next"),
        process.argv[2] ?? "dev",
        "--port",
        process.env.PORT ?? "3000",
        "--hostname",
        process.env.WEB_HOST ?? "127.0.0.1",
      ],
  {
    cwd: fileURLToPath(new URL("../apps/web", import.meta.url)),
    stdio: "inherit",
    env: {
      ...process.env,
      HOSTNAME: process.env.WEB_HOST ?? "127.0.0.1",
      PORT: process.env.PORT ?? "3000",
    },
  }
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  reportCliFailure(
    "web startup",
    error,
    "Run pnpm build before pnpm start:web; check the Node installation and PORT/WEB_HOST in .env."
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
