"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field } from "../ui";
import type { TrackerViewContext } from "./context";
/** Render admin-corrections using current controller state and explicit actions. */
export function AdminCorrectionsView(context: TrackerViewContext) {
  const { account, seasons, stats, loaded, rawKey, run, view } = context;
  return (
    <>
      {view === "admin-corrections" && (
        <>
          <h1>Correction grants</h1>
          <p>
            Grant keys let owners correct existing reports and eligible dates.
            Existing completion entitlements remain fixed.
          </p>
          {account?.admin && stats ? (
            <>
              <form
                className={uiStyles.card}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void run({
                    command: "BackdateEnrollment",
                    userId: d.get("userId"),
                    seasonId: d.get("seasonId"),
                    registeredDate: d.get("date"),
                  });
                }}
              >
                <h2>Backdated participation</h2>
                <Field label="Participant">
                  <select name="userId" required>
                    {stats.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Season">
                  <select required name="seasonId">
                    {seasons
                      .filter((s) => s.publishedAt)
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
                  The participant has 24 hours to fill missing reports. Unfilled
                  dates do not count.
                </p>
                <button type="submit" className={uiStyles.button}>
                  Create backdated participation
                </button>
              </form>
              <form
                className={uiStyles.card}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const kind = data.get("kind");
                  void run(
                    kind === "single_report"
                      ? {
                          command: "IssueCorrectionGrant",
                          kind,
                          reportId: data.get("reportId"),
                        }
                      : {
                          command: "IssueCorrectionGrant",
                          kind: "attempt_window",
                          attemptId: data.get("attemptId"),
                          durationMinutes: Number(data.get("minutes")),
                        }
                  );
                }}
              >
                <Field label="Grant scope">
                  <select name="kind">
                    <option value="single_report">
                      One report, one use, expires in 24 hours
                    </option>
                    <option value="attempt_window">
                      Attempt window, up to one hour
                    </option>
                  </select>
                </Field>
                <Field label="Report">
                  <select name="reportId">
                    {stats.reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        Day {r.reportingIndex} · {r.reportingDate} · {r.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Attempt">
                  <select name="attemptId">
                    {stats.attempts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.startedAt} · {a.reportingDays} reports · {a.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Window minutes">
                  <input
                    name="minutes"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={60}
                  />
                </Field>
                <button type="submit" className={uiStyles.button}>
                  Issue correction key
                </button>
              </form>
              {rawKey && (
                <div className={uiStyles.notice}>
                  <p>
                    Copy this key now and give it privately to the owner. It is
                    shown once.
                  </p>
                  <output className={uiStyles.key}>{rawKey}</output>
                </div>
              )}
              {stats.grants.map((g) => (
                <article key={g.id} className={uiStyles.card}>
                  <p>
                    {g.kind} · Expires {g.expiresAt} ·{" "}
                    {g.usedAt ? "Used" : g.revokedAt ? "Revoked" : "Available"}
                  </p>
                  <button
                    type="button"
                    className={`${uiStyles.button} ${uiStyles.secondary}`}
                    disabled={Boolean(g.usedAt || g.revokedAt)}
                    onClick={() =>
                      run({ command: "RevokeCorrectionGrant", grantId: g.id })
                    }
                  >
                    Revoke grant {g.id}
                  </button>
                </article>
              ))}
              <h2>Metadata</h2>
              {stats.attempts.map((a) => (
                <p key={a.id}>
                  {a.id} · {a.status} · {a.reportingDays} reports · Streak{" "}
                  {a.currentStreak}, longest {a.longestStreak} ·{" "}
                  {a.rerollCredits} credits
                </p>
              ))}
            </>
          ) : (
            loaded && <p>Administrator permission is required.</p>
          )}
        </>
      )}{" "}
    </>
  );
}
