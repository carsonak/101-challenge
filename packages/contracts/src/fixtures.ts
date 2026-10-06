import {
  progressSchema,
  startAttemptSchema,
  submitReportSchema,
} from "./tracker.js";

/** Deterministic fictional setup for adapter development; contains no participant data. */
export const setupFixture = startAttemptSchema.parse({
  command: "StartAttempt",
  enrollmentId: "10000000-0000-4000-8000-000000000001",
  expectedEnrollmentVersion: 0,
  timezone: "Africa/Nairobi",
  goals: [
    {
      title: "Practice drawing",
      kind: "duration",
      unit: "minutes",
      target: "30",
    },
  ],
});
/** Truthful fictional report showing that zero activity still counts as reporting. */
export const reportFixture = submitReportSchema.parse({
  command: "SubmitReport",
  attemptId: "10000000-0000-4000-8000-000000000002",
  expectedAttemptVersion: 1,
  body: "No practice today.",
  goalValues: [],
});
/** Metadata-only completed progress with gaps in calendar reporting. */
export const completedProgressFixture = progressSchema.parse({
  enrollmentId: setupFixture.enrollmentId,
  attemptId: reportFixture.attemptId,
  participation: "completed",
  attemptState: "completed",
  mode: "qualifying",
  reportingDays: 101,
  currentStreak: 1,
  longestStreak: 7,
  rerollCredits: 1,
  version: 101,
});
