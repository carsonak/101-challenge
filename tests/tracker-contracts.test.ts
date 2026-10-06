/**
 * @file Exercises tracker trust boundaries with deterministic fictional inputs.
 * Run with `pnpm test`; no services or credentials are needed.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  decimalValueSchema,
  startAttemptSchema,
  submitReportSchema,
  progressSchema,
} from "../packages/contracts/src/index.js";

/** Synthetic resource reference used only in these tests. */
const id = "10000000-0000-4000-8000-000000000001";
/** Fixture for a custom, non-reading setup. */
const setup = {
  command: "StartAttempt",
  enrollmentId: id,
  expectedEnrollmentVersion: 0,
  timezone: "Africa/Nairobi",
  goals: [
    {
      title: "Practice drawing",
      kind: "duration",
      target: "30",
      unit: "minutes",
    },
  ],
};
/** Fictional truthful report with no goal activity. */
const report = {
  command: "SubmitReport",
  attemptId: id,
  expectedAttemptVersion: 1,
  body: "No practice today.",
  goalValues: [],
};
test("setup supports custom goals and validates milestone references", () => {
  assert.equal(
    startAttemptSchema.parse(setup).goals[0]?.title,
    "Practice drawing"
  );
  for (const override of [
    { goals: [] },
    { timezone: "invalid" },
    {
      milestones: [
        {
          title: "Practice",
          targetReportingDay: 1,
          achievementKind: "manual",
          goalIndex: 1,
        },
      ],
    },
  ]) {
    assert.equal(
      startAttemptSchema.safeParse({ ...setup, ...override }).success,
      false
    );
  }
});
test("decimal precision is preserved without floating point conversion", () => {
  for (const value of ["0", "0.000001", "123456789012.123456"])
    assert.equal(decimalValueSchema.parse(value), value);
  for (const value of ["-1", "1e3", "01", "1.0000001", "1234567890123.123456"])
    assert.equal(decimalValueSchema.safeParse(value).success, false);
  assert.equal(
    startAttemptSchema.safeParse({
      ...setup,
      goals: [{ title: "Practice", kind: "count", target: "0.000000" }],
    }).success,
    false
  );
});
test("commands reject authoritative fields and duplicate revision values", () => {
  assert.equal(submitReportSchema.parse(report).body, report.body);
  for (const field of [
    "userId",
    "seed",
    "mode",
    "date",
    "reportingDate",
    "startedAt",
  ]) {
    assert.equal(
      submitReportSchema.safeParse({ ...report, [field]: id }).success,
      false
    );
    assert.equal(
      startAttemptSchema.safeParse({ ...setup, [field]: id }).success,
      false
    );
  }
  assert.equal(
    submitReportSchema.safeParse({
      ...report,
      goalValues: [
        { goalRevisionId: id, value: "0" },
        { goalRevisionId: id, value: "1" },
      ],
    }).success,
    false
  );
  assert.equal(
    submitReportSchema.safeParse({ ...report, body: "  " }).success,
    false
  );
});
test("metadata projections reject private fields rather than serializing them", () => {
  const progress = {
    enrollmentId: id,
    attemptId: id,
    participation: "completed",
    attemptState: "completed",
    mode: "qualifying",
    reportingDays: 101,
    currentStreak: 1,
    longestStreak: 7,
    rerollCredits: 1,
    version: 101,
  };
  assert.equal(progressSchema.safeParse(progress).success, true);
  for (const field of ["body", "baseSeed", "goals", "participantSeed"])
    assert.equal(
      progressSchema.safeParse({ ...progress, [field]: "private" }).success,
      false
    );
});

test("correction windows and confirmed restarts have bounded payloads", async () => {
  const { trackerCommandSchema } =
    await import("../packages/contracts/src/index.js");
  assert.equal(
    trackerCommandSchema.safeParse({
      command: "IssueCorrectionGrant",
      kind: "attempt_window",
      attemptId: id,
      durationMinutes: 61,
    }).success,
    false
  );
  assert.equal(
    trackerCommandSchema.safeParse({
      ...setup,
      command: "RestartAttempt",
      attemptId: id,
      expectedAttemptVersion: 0,
      confirmed: true,
    }).success,
    true
  );
  assert.equal(
    trackerCommandSchema.safeParse({
      ...setup,
      command: "RestartAttempt",
      attemptId: id,
      expectedAttemptVersion: 0,
    }).success,
    false
  );
  assert.equal(
    trackerCommandSchema.safeParse({ command: "Reroll", attemptId: id })
      .success,
    false
  );
});
