/**
 * @file Starts the local Compose services and waits up to 120 seconds for healthy containers.
 * Run `pnpm services:up` from the repository root with Docker or compatible Podman Compose.
 * Compose uses the local environment and may pull images or create/recreate containers,
 * networks and persistent volumes. Services remain running after this command finishes,
 * including after a health-check failure; use `pnpm services:down` to stop them.
 * Startup or health-check failures are reported with a nonzero exit status.
 * Runs immediately when executed or imported.
 */

import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { existsSync } from "node:fs";
import { reportCliFailure } from "./cli-diagnostics.mjs";

/** Compose reads local infrastructure settings from the same two files; nothing is passed to app processes. */
const compose = [
  "compose",
  ...[".env", ".env.operator"]
    .filter(existsSync)
    .flatMap((file) => ["--env-file", file]),
];

/**
 * Run Docker arguments and reject if the command cannot start or exits unsuccessfully.
 * Returns captured stdout, or an empty string when inheriting terminal output.
 * Runtime errors are forwarded to the terminal; arguments may change container state.
 */
function docker(args, inherit = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", (cause) =>
      reject(
        new Error(
          "Unable to start docker; check your container runtime installation",
          { cause }
        )
      )
    );
    child.once("exit", (code) => {
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            `docker ${args[0]} exited with status ${code}; see the runtime error above`
          )
        );
    });
  });
}

/** Start this checkout's Compose services and fail if they do not become healthy. */
async function main() {
  // Both Docker Compose and Podman Compose support detached startup.
  await docker([...compose, "up", "-d"], true);
  const ids = (await docker([...compose, "ps", "-q"]))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!ids.length)
    throw new Error("Compose started no containers; inspect docker compose ps");
  const deadline = Date.now() + 120000;
  console.info("Waiting for local services to become healthy...");
  while (true) {
    const output = await docker([
      "inspect",
      "--format",
      "{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}",
      ...ids,
    ]);
    const states = output
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/));
    if (
      states.length === ids.length &&
      states.every(
        ([, state, health]) => state === "running" && health === "healthy"
      )
    ) {
      console.info("Local services are healthy");
      return;
    }
    if (
      states.some(
        ([, state, health]) =>
          ["exited", "dead"].includes(state) || health === "unhealthy"
      )
    ) {
      throw new Error(
        "A local service failed its health check; inspect docker compose ps and docker compose logs"
      );
    }
    if (Date.now() >= deadline)
      throw new Error(
        "Local services did not become healthy within 120 seconds; inspect docker compose ps and docker compose logs"
      );
    await setTimeout(2000);
  }
}

main().catch((error) => {
  reportCliFailure(
    "services:up",
    error,
    "Inspect docker compose ps and docker compose logs; check .env/.env.operator infrastructure settings."
  );
  process.exitCode = 1;
});
