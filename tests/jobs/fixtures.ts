import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
/** Resolve the worker's own pinned queue package for integration fixtures. */
export const require = createRequire(
  new URL("../../apps/worker/package.json", import.meta.url)
);

/** Explicit disposable database; queue schema is unique to each test. */
export const url = process.env.TRACKER_TEST_DATABASE_URL;

if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Disposable database required");

/** Require fictional fixture existence. */
export function required<T>(v: T | null | undefined): T {
  assert.ok(v != null);
  return v;
}

/** Give destructive/housekeeping worker fixtures their own disposable database and cleanup. */
export async function target() {
  const connection = new URL(required(url));
  const name = `tracker_jobs_${randomUUID().replaceAll("-", "")}_test`;
  const { Pool } = createRequire(
    new URL("../../packages/db/package.json", import.meta.url)
  )("pg");

  const pool = new Pool({ connectionString: connection.toString(), max: 1 });
  await pool.query(`CREATE DATABASE "${name}"`);
  connection.pathname = `/${name}`;
  return {
    url: connection.toString(),
    async close() {
      await pool.query(`DROP DATABASE "${name}"`);
      await pool.end();
    },
  };
}
