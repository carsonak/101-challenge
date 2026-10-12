/** @file Process helper for isolated restore rehearsals. Importing starts no process. */
import { spawn } from "node:child_process";
/** Run the actual operator command; generic output contains no participant data. */
export async function runRehearsalBackup(
  recipient: string,
  mode: string,
  env: Record<string, string>
) {
  const child = spawn(process.execPath, ["scripts/backup.mjs", mode], {
    env: { ...process.env, AGE_RECIPIENT: recipient, ...env },
    stdio: "inherit",
  });

  await new Promise<void>((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? accept() : reject(new Error("Rehearsal operation failed"))
    );
  });
}
