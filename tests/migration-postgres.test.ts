/**
 * @file Upgrade regression from migrations 1–4 using an independently created disposable database.
 * Creates and drops only its own randomly named _test database; never runs against participant data.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRepository } from "../packages/db/src/index.js";
/** Resolve the existing database driver's dependency for migration-fixture SQL only. */
const { Pool } = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");
/** Disposable database opt-in follows the rest of the integration suite. */
const connection = process.env.TRACKER_TEST_DATABASE_URL;
if (connection && !/_(test|ci)$/.test(new URL(connection).pathname))
  throw new Error("Disposable database required");

test(
  "QA migrations preserve legacy pauses, timezones and unknown publication provenance",
  { skip: !connection },
  async () => {
    const name = `qa_upgrade_${randomUUID().replaceAll("-", "")}_test`;
    const manager = new Pool({ connectionString: connection });
    await manager.query(`CREATE DATABASE "${name}"`);
    const target = new URL(connection as string);
    target.pathname = `/${name}`;
    const sql = new Pool({ connectionString: target.toString() });
    const db = createRepository(target.toString());
    try {
      await sql.query(
        "CREATE TABLE tracker_migrations(version integer PRIMARY KEY)"
      );
      for (const [index, file] of [
        "0001_tracker.sql",
        "0002_identity.sql",
        "0003_adapters.sql",
        "0004_jobs.sql",
      ].entries()) {
        await sql.query(
          await readFile(
            new URL(`../packages/db/migrations/${file}`, import.meta.url),
            "utf8"
          )
        );
        await sql.query("INSERT INTO tracker_migrations VALUES($1)", [
          index + 1,
        ]);
      }
      const user = randomUUID(),
        season = randomUUID(),
        enrollment = randomUUID(),
        attempt = randomUUID();
      await sql.query("BEGIN");
      await sql.query(
        "INSERT INTO users VALUES($1,decode(repeat('01',32),'hex'),false,now(),now())",
        [user]
      );
      await sql.query(
        "INSERT INTO seasons VALUES($1,'Legacy season',NULL,'published',false,decode(repeat('02',32),'hex'),'[]','[]',NULL,0,now(),now())",
        [season]
      );
      await sql.query(
        "INSERT INTO enrollments VALUES($1,$2,$3,'cancelled','America/New_York',$4,false,1,now(),now())",
        [enrollment, user, season, attempt]
      );
      await sql.query(
        "INSERT INTO attempts VALUES($1,$2,1,'cancelled','qualifying',decode(repeat('03',32),'hex'),'attempt-v1',decode(repeat('04',32),'hex'),'[]','[]',now(),1,1,now(),now())",
        [attempt, enrollment]
      );
      await sql.query("COMMIT");
      await db.migrate();
      await db.repository.transaction(async (tx) => {
        assert.equal(
          (await tx.get("enrollments", enrollment))?.participation,
          "paused"
        );
        assert.equal(
          (await tx.get("enrollments", enrollment))?.timezone,
          "America/New_York"
        );
        assert.equal((await tx.get("attempts", attempt))?.status, "paused");
        assert.equal((await tx.get("seasons", season))?.publishedAt, null);
        assert.equal((await tx.get("profiles", user))?.provisional, true);
      });
      await db.migrate();
      assert.equal(
        (await sql.query("SELECT count(*)::int n FROM tracker_migrations"))
          .rows[0].n,
        6
      );
    } finally {
      await db.close();
      await sql.end();
      await manager.query(`DROP DATABASE "${name}"`);
      await manager.end();
    }
  }
);
