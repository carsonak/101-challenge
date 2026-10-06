/** @file Deterministic seed, civil-date and streak tests; run with pnpm test. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalJson,
  deriveAttemptSeed,
  reportingDate,
  streaks,
} from "../packages/core/src/index.js";

test("attempt-v1 matches the checked fictional vector and normalizes equivalent inputs", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../plans/artwork-generator/fixtures/base-seed-v1.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const goals = [
    {
      title: "Study Bitcoin",
      kind: "duration" as const,
      unit: "minutes",
      target: "30.000",
    },
  ];
  const milestones = [
    {
      title: "Explain a transaction",
      targetReportingDay: 7,
      goalIndex: 0,
      achievementKind: "manual" as const,
    },
  ];
  const result = deriveAttemptSeed(
    fixture.initial.participantSeed,
    fixture.seasonSeed,
    fixture.initial.startedAt,
    goals,
    milestones
  );
  assert.equal(result.baseSeed, fixture.baseSeed);
  assert.equal(result.initialInputDigest, fixture.initialInputDigest);
  assert.equal(
    canonicalJson({ b: "e\u0301\r\n", a: 1 }),
    canonicalJson({ a: 1, b: "é\n" })
  );
  assert.notEqual(
    deriveAttemptSeed(
      fixture.initial.participantSeed,
      fixture.seasonSeed,
      "2026-10-07T06:00:00.000Z",
      goals,
      milestones
    ).baseSeed,
    result.baseSeed
  );
});
test("reporting dates use frozen zones across DST and local midnight", () => {
  assert.equal(
    reportingDate(new Date("2026-10-06T21:00:00Z"), "Africa/Nairobi"),
    "2026-10-07"
  );
  assert.equal(
    reportingDate(new Date("2026-03-08T06:59:00Z"), "America/New_York"),
    "2026-03-08"
  );
  assert.equal(
    reportingDate(new Date("2026-03-09T03:59:00Z"), "America/New_York"),
    "2026-03-08"
  );
  assert.equal(
    reportingDate(new Date("2026-03-09T04:00:00Z"), "America/New_York"),
    "2026-03-09"
  );
});
test("streak gaps preserve longest and progress while separate runs earn separately", () => {
  const dates = [
    "2026-03-07",
    "2026-03-08",
    "2026-03-09",
    "2026-03-12",
    "2026-03-13",
  ];
  assert.deepEqual(streaks(dates, "2026-03-14"), {
    current: 2,
    longest: 3,
    trailing: 2,
  });
  assert.equal(streaks(dates, "2026-03-15").current, 0);
});
