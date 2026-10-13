/** @file Launch local commands with .env and optional .env.operator, scoped by role. Forwards signals and exit codes; never prints configuration. */
import { spawn } from "node:child_process";
import {
  localEnvironment,
  operatorCommands,
  readLocalSettings,
} from "./local-env.mjs";
import { reportCliFailure } from "./cli-diagnostics.mjs";
import { assertSupportedRuntime } from "./runtime.mjs";

/** Supported commands select their executable; remaining arguments are forwarded verbatim. */
const commands = {
  "web-dev": ["web", ["scripts/web.mjs", "dev"]],
  "web-start": ["web", ["scripts/web.mjs", "start"]],
  "worker-dev": ["worker", ["--import", "tsx", "apps/worker/src/index.ts"]],
  "worker-start": ["worker", ["apps/worker/dist/index.js"]],
  migrate: ["migrate", ["scripts/migrate.mjs"]],
  provision: [
    "provision",
    ["--import", "tsx", "scripts/provision-database.ts"],
  ],
  maintain: ["maintain", ["--import", "tsx", "scripts/account-maintenance.ts"]],
  maintenance: [
    "maintenance",
    ["--import", "tsx", "scripts/maintenance-scheduler.mjs"],
  ],
  register: ["register", ["--import", "tsx", "scripts/discord-register.ts"]],
  proxy: ["proxy", ["scripts/discord-proxy.mjs"]],
};

try {
  assertSupportedRuntime();
  const selected = commands[process.argv[2]];
  if (!selected)
    throw new Error(`Usage: local.mjs ${Object.keys(commands).join("|")}`);
  const [scope, args] = selected;
  const runtime = await readLocalSettings(".env");
  const operator = operatorCommands.has(scope)
    ? await readLocalSettings(".env.operator")
    : {};
  const env = localEnvironment(scope, runtime, operator);
  const child = spawn(process.execPath, [...args, ...process.argv.slice(3)], {
    env,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill(signal));
  child.once("error", (error) => {
    reportCliFailure(
      `local:${scope}`,
      error,
      "Check the local command and Node installation."
    );
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
} catch (error) {
  reportCliFailure(
    "local configuration",
    error,
    error.code === "UNSUPPORTED_NODE"
      ? "Select Node 24 using mise or nvm, then rerun the command."
      : "See docs/configuration.md and the two example files."
  );
  process.exitCode = 1;
}
