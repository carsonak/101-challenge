import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTracker } from "../../packages/core/src/index.js";
import { createRepository } from "../../packages/db/src/index.js";
/** Explicit isolated database opt-in; ordinary unit checks skip integrations. */
export const url = process.env.TRACKER_TEST_DATABASE_URL;

if (url && !/_(test|ci)$/.test(new URL(url).pathname))
  throw new Error("Integration database must end in _test or _ci");

/** Assert fixture existence at runtime so a missing record fails clearly. */
export function required<T>(value: T | null | undefined): T {
  assert.ok(value !== undefined && value !== null);
  return value;
}

/** Create a fictional test service with deterministic clock and real repository. */
export async function fixture() {
  const db = createRepository(required(url));
  await db.migrate();
  let instant = new Date("2026-01-01T09:00:00Z");
  const tracker = createTracker(db.repository, { now: () => instant });
  const admin = await tracker.createUser(true),
    user = await tracker.createUser();

  const create = await tracker.execute(
    admin,
    {
      command: "CreateSeason",
      slug: randomUUID(),
      title: "Fictional practice",
    },
    randomUUID()
  );

  await tracker.execute(
    admin,
    {
      command: "PublishSeason",
      seasonId: create.resourceId,
      expectedSeasonVersion: 0,
    },
    randomUUID()
  );

  const enroll = await tracker.execute(
    user,
    { command: "Enroll", seasonId: create.resourceId },
    randomUUID()
  );

  const setup = {
    command: "StartAttempt",
    enrollmentId: enroll.resourceId,
    expectedEnrollmentVersion: 0,
    timezone: "Africa/Nairobi",
    goals: [{ title: "Practice", kind: "count", target: "10" }],
    milestones: [
      {
        title: "First seven reports",
        targetReportingDay: 7,
        achievementKind: "reporting_count",
      },
    ],
  };

  const start = await tracker.execute(user, setup, randomUUID());
  return {
    db,
    tracker,
    admin,
    user,
    seasonId: create.resourceId,
    enrollmentId: enroll.resourceId,
    attemptId: start.resourceId,
    setup,
    advance(days = 1) {
      instant = new Date(instant.getTime() + days * 86400000);
    },
    setInstant(value: string) {
      instant = new Date(value);
    },
    async submit(version: number, key = randomUUID()) {
      return tracker.execute(
        user,
        {
          command: "SubmitReport",
          attemptId: start.resourceId,
          expectedAttemptVersion: version,
          body: "Fictional progress",
          goalValues: [],
        },
        key
      );
    },
  };
}
