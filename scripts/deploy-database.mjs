/** @file Private one-shot production bootstrap: roles|migrate|grants. Reads only explicit operator environment; never local files. No runtime service should receive these credentials. */
import { spawn } from "node:child_process";
import { createRepository } from "@challenge/db";

try {
  const phase = process.argv[2];
  if (phase === "migrate") {
    if (!process.env.MIGRATOR_DATABASE_URL) throw new Error();
    const database = createRepository(process.env.MIGRATOR_DATABASE_URL);
    try {
      await database.migrate();
    } finally {
      await database.close();
    }
  } else if (phase === "roles" || phase === "grants") {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/provision-database.ts", phase],
      { stdio: "inherit", env: process.env }
    );
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error())
      );
    });
  } else throw new Error();
  console.info("Database deployment phase completed.");
} catch {
  console.error(
    "Database deployment failed. Check the phase (roles|migrate|grants), private operator configuration and database readiness."
  );
  process.exitCode = 1;
}
