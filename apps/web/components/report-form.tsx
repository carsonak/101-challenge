"use client";
import { useState, type FormEvent } from "react";
import { Field, PasswordInput, Help } from "./ui";
import type { Attempt } from "./tracker-types";
/** Report form keeps unsent text when validation, connectivity or version errors occur. */
export function ReportForm({
  attempt,
  report,
  correction = false,
  backfill = false,
  earliest,
  run,
}: {
  attempt: Attempt;
  report?: Attempt["reports"][number];
  correction?: boolean;
  backfill?: boolean;
  earliest?: string;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const [date, setDate] = useState(report?.reportingDate ?? "");
  const [body, setBody] = useState(report?.body ?? ""),
    [key, setKey] = useState(""),
    [values, setValues] = useState<Record<string, string>>(
      Object.fromEntries(
        report?.goalValues.map((v) => [v.goalRevisionId, v.value]) ?? []
      )
    ),
    [achieved, setAchieved] = useState<string[]>([]);
  const activeGoals = attempt.goals
    .filter((g) => !g.archived)
    .map((g) => attempt.goalRevisions.find((r) => r.id === g.currentRevisionId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const allowed = report
    ? attempt.goalRevisions.filter((r) =>
        report.applicableGoalRevisionIds.includes(r.id)
      )
    : activeGoals;
  /** Submit the explicit form draft without clearing it on errors. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const command = report
      ? {
          command: correction ? "CorrectReport" : "EditReport",
          reportId: report.id,
          expectedReportVersion: report.version,
          ...(correction
            ? { ...(key ? { key } : {}), reportingDate: date }
            : {}),
        }
      : {
          command: backfill ? "BackfillReport" : "SubmitReport",
          ...(backfill ? { reportingDate: date } : {}),
          attemptId: attempt.attemptId,
          expectedAttemptVersion: attempt.version,
          milestoneAchievements: achieved,
        };
    if (
      await run({
        ...command,
        body,
        goalValues: Object.entries(values)
          .filter(([, value]) => value !== "")
          .map(([goalRevisionId, value]) => ({ goalRevisionId, value })),
      })
    ) {
      if (!report) {
        setBody("");
        setValues({});
        setAchieved([]);
      }
      setKey("");
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3>
        {report
          ? correction
            ? "Correct this report with a key"
            : "Edit today’s report"
          : backfill
            ? "Fill a skipped date"
            : "Today’s report"}
      </h3>
      <Help>
        A truthful report counts even when you did not work on your goals.
        Reports use your fixed local date.
      </Help>
      {(correction || backfill) && (
        <Field label="Reporting date">
          <select
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            <option value="">Choose an available date</option>
            {Array.from(
              {
                length: Math.max(
                  0,
                  Math.min(
                    36600,
                    Math.floor(
                      (Date.parse(attempt.today) -
                        Date.parse(
                          earliest ?? attempt.startedAt.slice(0, 10)
                        )) /
                        86400000
                    ) + 1
                  )
                ),
              },
              (_, i) =>
                new Date(
                  Date.parse(earliest ?? attempt.startedAt.slice(0, 10)) +
                    i * 86400000
                )
                  .toISOString()
                  .slice(0, 10)
            )
              .filter(
                (d) =>
                  !attempt.reports.some(
                    (r) => r.id !== report?.id && r.reportingDate === d
                  )
              )
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Your private report">
        <textarea
          required
          rows={5}
          minLength={1}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      {allowed
        .filter((g) => g.input.kind !== "qualitative")
        .map((g) => (
          <Field
            key={g.id}
            label={`${g.input.title}${g.input.unit ? ` (${g.input.unit})` : ""}`}
          >
            <input
              inputMode="decimal"
              value={values[g.id] ?? ""}
              onChange={(e) => setValues({ ...values, [g.id]: e.target.value })}
            />
          </Field>
        ))}
      {!report &&
        attempt.milestones
          .filter((m) => !m.archived)
          .map((m) => ({
            m,
            revision: attempt.milestoneRevisions.find(
              (r) => r.id === m.currentRevisionId
            ),
          }))
          .filter(
            ({ revision }) =>
              revision?.input.targetReportingDay ===
                (backfill
                  ? attempt.reports.filter((r) => r.reportingDate < date)
                      .length + 1
                  : attempt.reportingDays + 1) &&
              revision.input.achievementKind === "manual"
          )
          .map(({ m, revision }) => (
            <label key={m.id} className="check">
              <input
                type="checkbox"
                checked={achieved.includes(m.id)}
                onChange={(e) =>
                  setAchieved(
                    e.target.checked
                      ? [...achieved, m.id]
                      : achieved.filter((id) => id !== m.id)
                  )
                }
              />
              I achieved: {revision?.input.title}
            </label>
          ))}
      {correction &&
        !(
          attempt.backfillUntil &&
          Date.parse(attempt.backfillUntil) > Date.now()
        ) && (
          <Field label="Correction key">
            <PasswordInput
              required

              autoComplete="off"
              minLength={64}
              maxLength={64}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
        )}
      <button type="submit">
        {report
          ? "Save report changes"
          : backfill
            ? "Save backdated report"
            : "Submit today’s report"}
      </button>
    </form>
  );
}
