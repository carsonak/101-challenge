/** @file Operator backup/monitor failure paths must fail closed without publishing success or private details. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

/** Execute operator tools with fixture-only environment and capture their intentionally generic diagnostics. */
async function run(file: string, args: string[], env: Record<string, string>) {
  const child = spawn(process.execPath, [file, ...args], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (bytes) => {
    output += bytes;
  });

  child.stderr.on("data", (bytes) => {
    output += bytes;
  });

  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  return { code, output };
}

test("a failed dump producer cannot publish an archive or fresh backup marker", async () => {
  const directory = await mkdtemp(join(tmpdir(), "challenge-backup-failure-"));
  try {
    const pg = join(directory, "pg-dump"),
      age = join(directory, "age");

    await writeFile(
      pg,
      `#!${process.execPath}\nprocess.stdout.write("incomplete fictional dump"); process.exitCode=1;\n`,
      { mode: 0o700 }
    );

    // A stream double isolates producer failure ordering; this is not encryption evidence.
    await writeFile(
      age,
      `#!${process.execPath}\nprocess.stdin.pipe(process.stdout);\n`,
      { mode: 0o700 }
    );

    const backup = join(directory, "output");
    const result = await run("scripts/backup.mjs", ["backup"], {
      BACKUP_DATABASE_URL:
        "postgresql://fictional:private-test-password@127.0.0.1:1/failure_test",
      BACKUP_DIR: backup,
      AGE_RECIPIENT: "age1fictional",
      PG_DUMP_BIN: pg,
      AGE_BIN: age,
      BACKUP_REQUIRE_REMOTE: "false",
      BACKUP_S3_BUCKET: "",
    });

    assert.equal(result.code, 1);
    assert.deepEqual(await readdir(backup), []);
    assert.doesNotMatch(
      result.output,
      /private-test-password|incomplete fictional dump/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("required remote backup rejects missing storage before producing an archive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "challenge-backup-remote-"));
  try {
    const result = await run("scripts/backup.mjs", ["backup"], {
      BACKUP_DATABASE_URL:
        "postgresql://fictional:private-test-password@127.0.0.1:1/failure_test",
      BACKUP_DIR: directory,
      BACKUP_REQUIRE_REMOTE: "true",
      BACKUP_S3_BUCKET: "",
    });

    assert.equal(result.code, 1);
    assert.deepEqual(await readdir(directory), []);
    assert.doesNotMatch(result.output, /private-test-password/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("monitor rejects stale/local-only/future success markers and emits only fixed outcomes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "challenge-monitor-"));
  const marker = join(directory, "last-backup.json");
  try {
    for (const data of [
      {
        remote: true,
        completedAt: new Date(Date.now() - 27 * 3600000).toISOString(),
      },
      { remote: false, completedAt: new Date().toISOString() },
      {
        remote: true,
        completedAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ]) {
      await writeFile(marker, JSON.stringify(data));
      const result = await run("scripts/operations-check.mjs", [], {
        BACKUP_SUCCESS_FILE: marker,
        OPERATIONS_DATABASE_URL:
          "postgresql://fixture:private-test-password@127.0.0.1:1/failure_test",
        OPERATIONS_READY_URL: "http://127.0.0.1:1/api/ready",
      });

      assert.equal(result.code, 1);
      assert.match(result.output, /"check":"backup_fresh","ok":false/);
      assert.doesNotMatch(
        result.output,
        /private-test-password|postgresql|ECONNREFUSED/
      );
    }

    await writeFile(
      marker,
      JSON.stringify({ remote: true, completedAt: new Date().toISOString() })
    );

    const fresh = await run("scripts/operations-check.mjs", [], {
      BACKUP_SUCCESS_FILE: marker,
      OPERATIONS_DATABASE_URL: "",
      OPERATIONS_READY_URL: "http://127.0.0.1:1/api/ready",
    });

    assert.match(fresh.output, /"check":"backup_fresh","ok":true/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
