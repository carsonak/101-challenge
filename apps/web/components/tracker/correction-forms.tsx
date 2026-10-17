"use client";
import { useState } from "react";
import type { Season, Stats } from "../tracker-types";
import { Field } from "../ui";
import uiStyles from "../../styles/ui.module.css";

/** Scope every grant to a named participant and selected retained attempt; require recipient confirmation before issuing. */
export function CorrectionForms({
  person,
  stats,
  seasons,
  busy,
  run,
}: {
  person: { id: string; username: string };
  stats: Stats;
  seasons: Season[];
  busy: boolean;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const [attemptId, setAttemptId] = useState("");
  const [kind, setKind] = useState("single_report");
  const [reportId, setReportId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const reports = stats.reports.filter((r) => r.attemptId === attemptId);
  const ready =
    attemptId &&
    (kind === "attempt_window" || reports.some((r) => r.id === reportId));

  return (
    <>
      <form
        className={uiStyles.card}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run({
            command: "BackdateEnrollment",
            userId: person.id,
            seasonId: data.get("seasonId"),
            registeredDate: data.get("date"),
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Backdated participation for {person.username}</legend>
          <Field label="Season">
            <select name="seasonId" required defaultValue="">
              <option value="" disabled>
                Choose a published season with goals
              </option>
              {seasons
                .filter((s) => s.publishedAt && s.goals.length)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Effective registration date">
            <input required name="date" type="date" />
          </Field>
          <p>
            Use a date from first publication through today in the reporting
            timezone. The participant must not already be enrolled. They have 24
            hours to fill missing reports; unfilled dates do not count.
          </p>
          <button type="submit" className={uiStyles.button}>
            Create backdated participation for {person.username}
          </button>
        </fieldset>
      </form>
      <form
        className={uiStyles.card}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready || !confirmed || busy) return;

          const data = new FormData(event.currentTarget);
          if (
            await run(
              kind === "single_report"
                ? { command: "IssueCorrectionGrant", kind, reportId }
                : {
                    command: "IssueCorrectionGrant",
                    kind: "attempt_window",
                    attemptId,
                    durationMinutes: Number(data.get("minutes")),
                  }
            )
          )
            setConfirmed(false);
        }}
      >
        <fieldset disabled={busy}>
          <legend>Issue a correction key to {person.username}</legend>
          <Field label="Attempt">
            <select
              required
              value={attemptId}
              onChange={(event) => {
                setAttemptId(event.target.value);
                setReportId("");
                setConfirmed(false);
              }}
            >
              <option value="">Choose an attempt</option>
              {stats.attempts.map((a) => (
                <option key={a.id} value={a.id}>
                  {person.username} · {a.startedAt} · {a.status} ·{" "}
                  {a.reportingDays} reports · {a.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grant scope">
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setConfirmed(false);
              }}
            >
              <option value="single_report">
                One report, one use, expires in 24 hours
              </option>
              <option value="attempt_window">
                Attempt window, up to one hour
              </option>
            </select>
          </Field>
          {kind === "single_report" ? (
            <Field label="Report">
              <select
                required
                value={reportId}
                onChange={(event) => {
                  setReportId(event.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose a report</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {person.username} · Day {r.reportingIndex} ·{" "}
                    {r.reportingDate}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Window minutes">
              <input
                required
                name="minutes"
                type="number"
                min={1}
                max={60}
                defaultValue={60}
              />
            </Field>
          )}
          <label className={uiStyles.check}>
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm this key is for {person.username} and the selected{" "}
            {kind === "single_report" ? "report" : "attempt"}.
          </label>
          <button
            type="submit"
            className={uiStyles.button}
            disabled={!ready || !confirmed}
          >
            Issue correction key
          </button>
        </fieldset>
      </form>
    </>
  );
}
