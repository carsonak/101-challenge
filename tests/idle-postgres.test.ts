/** @file Durable work hints, shared abuse controls and maintenance deadlines on exclusive synthetic storage. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createRepository, createJobStore } from "../packages/db/src/index.js";
import { createAuth, createTracker } from "../packages/core/src/index.js";
import { target, url } from "./jobs/fixtures.js";
const { Pool } = createRequire(
  new URL("../packages/db/package.json", import.meta.url)
)("pg");

test(
  "Committed queue writes poke once; reads, failed transactions and notifier failures preserve transaction truth",
  { skip: !url },
  async () => {
    const isolated = await target();
    const hints: string[] = [];
    const db = createRepository(isolated.url, false, (service) => {
      hints.push(service);
      throw new Error("lost hint");
    });

    try {
      await db.migrate();
      const tracker = createTracker(db.repository),
        admin = await tracker.createUser(true);

      const season = await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional wake fixture",
        },
        randomUUID()
      );

      assert.deepEqual(hints, ["worker"]);
      const events = await db.repository.transaction((tx) =>
        tx.list("outbox", { aggregateId: season.resourceId })
      );

      assert.equal(hints.length, 1);
      assert.ok(events[0]);
      await assert.rejects(
        db.repository.transaction(async (tx) => {
          await tx.insert("outbox", { ...events[0], id: randomUUID() });
          throw new Error("rollback");
        })
      );

      assert.equal(hints.length, 1);
      assert.equal(
        (
          await db.repository.transaction((tx) =>
            tx.list("outbox", { aggregateId: season.resourceId })
          )
        ).length,
        events.length
      );
    } finally {
      await db.close();
      await isolated.close();
    }
  }
);

test(
  "Database limits are shared across replicas and restarts, opaque and bounded; expiry permits a new reservation",
  { skip: !url },
  async () => {
    const isolated = await target();
    const one = createRepository(isolated.url, true),
      two = createRepository(isolated.url, true);

    const owner = createRepository(isolated.url);
    const sql = new Pool({ connectionString: isolated.url });
    try {
      await owner.migrate();
      const attempts = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          (index % 2 ? one : two).rates.take(
            "login",
            "fictional@example.invalid",
            5,
            60000
          )
        )
      );

      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 5);
      assert.ok(
        attempts
          .filter((r) => r.status === "rejected")
          .every(
            (r) => r.status === "rejected" && r.reason.code === "RATE_LIMITED"
          )
      );

      assert.equal(
        await one.rates.allow("mail", "fictional@example.invalid", 60000),
        true
      );

      assert.equal(
        await two.rates.allow("mail", "fictional@example.invalid", 60000),
        false
      );

      await one.close();
      const restarted = createRepository(isolated.url, true);
      try {
        assert.equal(
          await restarted.rates.allow(
            "mail",
            "fictional@example.invalid",
            60000
          ),
          false
        );
      } finally {
        await restarted.close();
      }

      const records = await sql.query("SELECT * FROM throttle_buckets");
      assert.equal(JSON.stringify(records.rows).includes("fictional"), false);
      await sql.query(
        "UPDATE throttle_buckets SET \"expiresAt\"=now()-interval '1 second'"
      );

      assert.equal(
        await two.rates.allow("mail", "fictional@example.invalid", 60000),
        true
      );

      await sql.query("TRUNCATE throttle_buckets");
      await sql.query(
        `INSERT INTO throttle_buckets SELECT n::text,1,now()+interval '1 hour' FROM generate_series(1,10000) n`
      );

      await assert.rejects(two.rates.take("new", "identity", 5, 60000), {
        code: "RATE_LIMITED",
      });

      assert.equal(
        (await sql.query("SELECT count(*)::int AS count FROM throttle_buckets"))
          .rows[0].count,
        10000
      );

      const denied = await sql.connect();
      try {
        await denied.query("SET ROLE challenge_tracker_app");
        await assert.rejects(denied.query("SELECT * FROM throttle_secret"), {
          code: "42501",
        });

        await assert.rejects(denied.query("SELECT * FROM throttle_buckets"), {
          code: "42501",
        });
      } finally {
        denied.release();
      }
    } finally {
      await two.close();
      await owner.close();
      await sql.end();
      await isolated.close();
    }
  }
);

test(
  "Mail retry and deletion deadlines remain discoverable without traffic, and expiry-at-read does not depend on cleanup",
  { skip: !url },
  async () => {
    const isolated = await target();
    const hints: string[] = [];
    const db = createRepository(isolated.url, false, (service) =>
      hints.push(service)
    );

    const sql = new Pool({ connectionString: isolated.url });
    const store = createJobStore(isolated.url);
    try {
      await db.migrate();
      const tracker = createTracker(db.repository),
        user = await tracker.createUser();

      const requestId = randomUUID();
      const deadline = new Date(Date.now() + 86400000).toISOString();
      await db.repository.transaction(async (tx) => {
        const profile = await tx.get("profiles", user);
        assert.ok(profile);
        await tx.save("profiles", {
          ...profile,
          recoveryEmail: "fictional@example.invalid",
        });

        await tx.insert("erasure_requests", {
          id: requestId,
          userId: user,
          requestedAt: new Date().toISOString(),
          deleteAfter: deadline,
          cancelledAt: null,
          processedAt: null,
        });

        await tx.insert("account_mail", {
          id: randomUUID(),
          userId: user,
          requestId,
          sentAt: null,
          nextAttemptAt: new Date().toISOString(),
          failures: 0,
        });
      });

      assert.deepEqual(hints, ["maintenance"]);
      const retryAt = await db.maintainAccounts(async () => {
        throw new Error("SMTP unavailable");
      });

      assert.ok(
        retryAt && retryAt > Date.now() && retryAt < Date.parse(deadline)
      );

      await sql.query('UPDATE account_mail SET "nextAttemptAt"=now()');
      let deliveries = 0;
      const send = async () => {
        deliveries++;
      };

      await Promise.all([db.maintainAccounts(send), db.maintainAccounts(send)]);
      assert.equal(deliveries, 1);
      assert.equal(await db.nextAccountWork(), Date.parse(deadline));
      await sql.query(
        "UPDATE erasure_requests SET \"deleteAfter\"=now()-interval '1 second'"
      );

      await db.maintainAccounts(send);
      assert.equal(await db.nextAccountWork(), null);
      assert.ok((await db.deletionLedger()).some((row) => row.userId === user));

      const owner = await tracker.createUser();
      const token = "a".repeat(64),
        csrf = "b".repeat(64);

      const { createHash } = await import("node:crypto");
      const id = randomUUID();
      await db.repository.transaction(async (tx) => {
        await tx.insert("sessions", {
          id: randomUUID(),
          tokenHash: createHash("sha256").update(token).digest("hex"),
          userId: owner,
          csrfHash: createHash("sha256").update(csrf).digest("hex"),
          authenticatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          revokedAt: null,
          device: "Fictional",
        });

        await tx.insert("notifications", {
          id,
          userId: owner,
          message: "Fictional expired notice",
          href: "/home",
          createdAt: "2000-01-01T00:00:00Z",
          readAt: null,
          dismissedAt: null,
        });
      });

      const auth = createAuth(db.repository, { sendMail: async () => {} });
      assert.deepEqual(await auth.notifications(token), []);
      assert.ok(
        await db.repository.transaction((tx) => tx.get("notifications", id))
      );

      await store.housekeeping();
      assert.equal(
        await db.repository.transaction((tx) => tx.get("notifications", id)),
        undefined
      );
    } finally {
      await store.close();
      await db.close();
      await sql.end();
      await isolated.close();
    }
  }
);

test(
  "Expired lease takeover is fenced against a late failure and acquiring a lease consumes no retry",
  { skip: !url },
  async () => {
    const isolated = await target();
    const db = createRepository(isolated.url),
      first = createJobStore(isolated.url),
      second = createJobStore(isolated.url);

    const sql = new Pool({ connectionString: isolated.url });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    let entered: () => void = () => {};
    const claimed = new Promise<void>((resolve) => {
      entered = resolve;
    });

    let pending: Promise<unknown> | undefined;
    try {
      await db.migrate();
      const tracker = createTracker(db.repository),
        admin = await tracker.createUser(true);

      await tracker.execute(
        admin,
        {
          command: "CreateSeason",
          slug: randomUUID(),
          title: "Fictional lease takeover",
        },
        randomUUID()
      );

      pending = first.publish(async () => {
        entered();
        await gate;
        throw new Error("late failure");
      });

      await claimed;
      const leased = (await sql.query("SELECT * FROM outbox")).rows[0];
      assert.ok(leased.leasedUntil);
      assert.equal(leased.deliveries, 0);
      await sql.query(
        "UPDATE outbox SET \"leasedUntil\"=now()-interval '1 second'"
      );

      await second.publish(async (event) => {
        await second.process(event);
      });

      release();
      await pending;
      const completed = (await sql.query("SELECT * FROM outbox")).rows[0];
      assert.ok(completed.publishedAt);
      assert.equal(completed.deliveries, 0);
      assert.equal(completed.lastFailureAt, null);
      assert.equal(await second.nextDue(), null);
    } finally {
      release();
      await pending;
      await first.close();
      await second.close();
      await db.close();
      await sql.end();
      await isolated.close();
    }
  }
);

test(
  "Housekeeping drains bounded batches and exposes the next retention deadline",
  { skip: !url },
  async () => {
    const isolated = await target();
    const db = createRepository(isolated.url),
      store = createJobStore(isolated.url);

    const sql = new Pool({ connectionString: isolated.url });
    try {
      await db.migrate();
      await sql.query(
        `INSERT INTO throttle_buckets SELECT n::text,1,now()-interval '1 hour' FROM generate_series(1,1200) n`
      );

      assert.equal((await store.housekeeping()).more, true);
      assert.equal(
        (await sql.query("SELECT count(*)::int AS count FROM throttle_buckets"))
          .rows[0].count,
        700
      );

      assert.equal((await store.housekeeping()).more, true);
      assert.equal((await store.housekeeping()).more, false);
      const tracker = createTracker(db.repository),
        user = await tracker.createUser();

      const createdAt = new Date(Date.now() - 89 * 86400000).toISOString();
      await db.repository.transaction((tx) =>
        tx.insert("notifications", {
          id: randomUUID(),
          userId: user,
          message: "Fictional near-retention notice",
          href: "/home",
          createdAt,
          readAt: null,
          dismissedAt: null,
        })
      );

      assert.equal(
        (await store.housekeeping()).nextDue,
        Date.parse(createdAt) + 90 * 86400000
      );
    } finally {
      await store.close();
      await db.close();
      await sql.end();
      await isolated.close();
    }
  }
);
