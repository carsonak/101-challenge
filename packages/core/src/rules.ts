import { createHash, createHmac } from "node:crypto";
import type { GoalInput, MilestoneInput } from "./model.js";

/** Canonical JSON recursively sorts keys, normalizes strings and preserves array order. */
export function canonicalJson(value: unknown): string {
  function normalize(input: unknown): unknown {
    if (typeof input === "string")
      return input.replace(/\r\n?/g, "\n").normalize("NFC");
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, normalize(v)])
      );
    if (typeof input === "number" && !Number.isSafeInteger(input))
      throw new Error("Unsafe canonical number");
    return input;
  }
  return JSON.stringify(normalize(value));
}
/** Normalize a validated nonnegative decimal without converting to binary floating point. */
export function canonicalDecimal(value: string): string {
  return value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value;
}
/** Private stable digest used for request equality and hashed opaque tokens. */
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
/** Derive a private attempt seed according to the accepted attempt-v1 fixture recipe. */
export function deriveAttemptSeed(
  participantSeed: string,
  seasonSeed: string,
  startedAt: string,
  goals: GoalInput[],
  milestones: MilestoneInput[]
) {
  const initial = {
    version: 1,
    participantSeed,
    startedAt,
    goals: goals.map((g) => ({
      title: g.title,
      description: g.description ?? null,
      metricKind: g.kind,
      unit: g.unit ?? null,
      target: g.target === undefined ? null : canonicalDecimal(g.target),
    })),
    milestones: milestones.map((m) => ({
      title: m.title,
      description: m.description ?? null,
      targetReportingDay: m.targetReportingDay,
      goalIndex: m.goalIndex ?? null,
    })),
  };
  const serialized = canonicalJson(initial);
  return {
    /** Private seed; never include in transport projections. */
    baseSeed: createHmac("sha256", Buffer.from(seasonSeed, "hex"))
      .update(`attempt-v1\n${serialized}`)
      .digest("hex"),
    /** Private digest of frozen canonical inputs. */
    initialInputDigest: digest(serialized),
  };
}
/** Resolve the server instant once using the enrollment's frozen IANA timezone. */
export function reportingDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Streaks use civil-day ordinals, independent of DST's 23/25-hour days. */
export function streaks(dates: string[], today: string) {
  const days = [...new Set(dates)]
    .sort()
    .map((d) => Date.parse(`${d}T00:00:00Z`) / 86400000);
  let run = 0,
    longest = 0,
    last: number | undefined;
  for (const day of days) {
    run = last !== undefined && day === last + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = day;
  }
  const now = Date.parse(`${today}T00:00:00Z`) / 86400000;
  return {
    /** Trailing run remains current through the day following the last report. */
    current: last !== undefined && (last === now || last === now - 1) ? run : 0,
    /** Longest retained run, unaffected by later gaps. */
    longest,
    /** Run ending at the last report, used when granting earning-report credits. */
    trailing: run,
  };
}

/**
 * Compute the active streak tier independently of banked reroll credits.
 * Each seven-day run increment earns a tier; each missed date removes one tier.
 * A pause discards the preceding tier. Concrete tier benefits belong to artwork.
 */
export function activePerkTier(
  dates: string[],
  today: string,
  after: string | null = null
): number {
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86400000;
  let tier = 0,
    run = 0,
    last: number | undefined;
  for (const date of [...new Set(dates)]
    .filter((d) => !after || d > after)
    .sort()) {
    const current = day(date),
      gap = last === undefined ? 0 : Math.max(0, current - last - 1);
    tier = Math.max(0, tier - gap);
    run = last !== undefined && current === last + 1 ? run + 1 : 1;
    if (run % 7 === 0) tier++;
    last = current;
  }
  return last === undefined
    ? 0
    : Math.max(0, tier - Math.max(0, day(today) - last - 1));
}
