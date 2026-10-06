import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url)
);
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
