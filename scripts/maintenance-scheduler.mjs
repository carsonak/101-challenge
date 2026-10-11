/** @file Private production scheduler. Runs one erasure/mail sweep per minute without overlap; forwards shutdown and never loads web credentials. */
import { spawn } from "node:child_process";
/** Shutdown cancels the next sweep and forwards termination to the active operation. */
let stopping = false,
  active,
  wake;
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    stopping = true;
    active?.kill(signal);
    wake?.();
  });
while (!stopping) {
  active = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/account-maintenance.ts"],
    { stdio: "inherit", env: process.env }
  );
  await new Promise((resolve) => {
    active.once("error", resolve);
    active.once("close", resolve);
  });
  active = undefined;
  if (!stopping)
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 60000);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  wake = undefined;
}
