"use client";
import uiStyles from "./../styles/ui.module.css";
import screensStyles from "./../styles/screens.module.css";

import { ProgressGrid } from "./progress-grid";
import { useEffect, useState } from "react";
import type { createTracker } from "@challenge/core";
/** Small rotating collection of helpful, nonessential challenge tips. */
const tips = [
  "A truthful report counts even on a day without goal activity.",
  "Make your goals small enough to practise consistently.",
  "Milestones celebrate reporting progress, not elapsed calendar days.",
  "Your logs are private. Export a copy from account settings whenever you like.",
];

/** Owner dashboard uses already-authorized history; artwork appears only after its separate release. */
export default function HomeScreen({
  history,
  seasons,
}: {
  history: Awaited<ReturnType<ReturnType<typeof createTracker>["history"]>>;
  seasons: Awaited<ReturnType<ReturnType<typeof createTracker>["seasons"]>>;
}) {
  const [enabled, setEnabled] = useState(true),
    [tip, setTip] = useState(0);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("show-tips") !== "false");
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (!document.hidden)
        setTip(
          (i) =>
            (i + 1 + Math.floor(Math.random() * (tips.length - 1))) %
            tips.length
        );
    }, 30000);

    return () => clearInterval(timer);
  }, [enabled]);

  const active = history.filter(
    (e) => e.participation === "active" || e.participation === "paused"
  );

  return (
    <>
      <p className={uiStyles.eyebrow}>Your practice, day by day</p>
      <h1>Keep showing up.</h1>
      {!active.length && (
        <section className={uiStyles.card}>
          <h2>Your next chapter</h2>
          <p>Choose a season and make a plan that works for you.</p>
          <a className={uiStyles.button} href="/seasons">
            Explore seasons
          </a>
        </section>
      )}
      {active.map((e) => {
        const a = e.attempts.find((a) => a.attemptId === e.currentAttemptId);
        return (
          <section className={uiStyles.card} key={e.id}>
            <h2>
              <a href={`/challenge/${e.id}`}>
                {seasons.find((s) => s.id === e.seasonId)?.title ??
                  "Your season"}
              </a>
            </h2>
            <a className={uiStyles.button} href={`/challenge/${e.id}`}>
              {!a
                ? "Set up your goals"
                : e.participation === "paused"
                  ? "Review paused challenge"
                  : a.attemptState === "completed"
                    ? "View completed challenge"
                    : a.reports.some((r) => r.reportingDate === a.today)
                      ? "Edit today's report"
                      : "Write today's report"}
            </a>
            <div className={screensStyles["home-overview"]}>
              {a && (
                <ProgressGrid
                  count={a.reportingDays}
                  todayReported={a.reports.some(
                    (r) => r.reportingDate === a.today
                  )}
                  milestoneIndexes={a.milestoneRevisions
                    .filter((r) =>
                      a.milestones.some(
                        (m) => !m.archived && m.currentRevisionId === r.id
                      )
                    )
                    .map((r) => r.input.targetReportingDay)}
                />
              )}
              <div className={screensStyles["home-notes"]}>
                <div className={uiStyles.metrics}>
                  <div>
                    <strong>{a?.currentStreak ?? 0}</strong>
                    <span>Current streak</span>
                  </div>
                  <div>
                    <strong>{a?.reportingDays ?? 0}/101</strong>
                    <span>Reporting days</span>
                  </div>
                  <div>
                    <strong>{a?.rerollCredits ?? 0}</strong>
                    <span>Banked credits</span>
                  </div>
                </div>
                {/* TODO(artwork): Update this unavailable-state copy when artwork and credit spending ship; see plans/artwork-generator. */}
                <p>
                  Credits are recorded for future artwork. Spending is not
                  available yet.
                </p>
                <h3>Upcoming milestones</h3>
                {!a?.milestones.some((m) => !m.archived && !m.locked) && (
                  <p className={"muted"}>
                    No upcoming milestones in this plan.
                  </p>
                )}
                {a?.milestones
                  .filter((m) => !m.archived && !m.locked)
                  .map((m) => (
                    <p key={m.id}>
                      {
                        a.milestoneRevisions.find(
                          (r) => r.id === m.currentRevisionId
                        )?.input.title
                      }
                    </p>
                  ))}
                <h3>Latest logs</h3>
                {!a?.reports.length && (
                  <p className={"muted"}>
                    Your private notes will appear here after your first report.
                  </p>
                )}
                {a?.reports
                  .slice(-3)
                  .reverse()
                  .map((r) => (
                    <article key={r.id}>
                      <strong>{r.reportingDate}</strong>
                      <p className={uiStyles["private-text"]}>{r.body}</p>
                    </article>
                  ))}
              </div>
            </div>
          </section>
        );
      })}
      {history.some((e) => e.completion) && (
        <section className={uiStyles.card}>
          <h2>Completed seasons</h2>
          {/* TODO(artwork): Update this unavailable-state copy when artwork and credit spending ship; see plans/artwork-generator. */}
          <p>
            You showed up for 101 reporting days. Your seasonal completion is
            saved, even when you start again. Artwork comes in a later release.
          </p>
          {history
            .filter((e) => e.completion)
            .map((e) => (
              <p key={e.id}>
                <a href={`/challenge/${e.id}`}>
                  {seasons.find((s) => s.id === e.seasonId)?.title ??
                    "Completed season"}
                </a>{" "}
                · 101 reporting days complete
              </p>
            ))}
        </section>
      )}
      <section className={uiStyles.card}>
        <label className={uiStyles.check}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              try {
                localStorage.setItem("show-tips", String(e.target.checked));
              } catch {}
            }}
          />
          Show hints and tips
        </label>
        {enabled && <p>{tips[tip]}</p>}
      </section>
    </>
  );
}
