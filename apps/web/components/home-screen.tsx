"use client";
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
      <p className="eyebrow">Your practice, day by day</p>
      <h1>Keep showing up.</h1>
      {!active.length && (
        <section className="card">
          <h2>Your next chapter</h2>
          <p>Choose a season and make a plan that works for you.</p>
          <a className="button" href="/seasons">
            Explore seasons
          </a>
        </section>
      )}
      {active.map((e) => {
        const a = e.attempts.find((a) => a.attemptId === e.currentAttemptId);
        return (
          <section className="card" key={e.id}>
            <h2>
              <a href={`/challenge/${e.id}`}>
                {seasons.find((s) => s.id === e.seasonId)?.title ??
                  "Your season"}
              </a>
            </h2>
            <div className="metrics">
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
                <span>Reroll credits</span>
              </div>
            </div>
            <h3>Upcoming milestones</h3>
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
            <a className="button" href={`/challenge/${e.id}`}>
              {a ? "Continue" : "Set up your goals"}
            </a>
            <h3>Latest logs</h3>
            {a?.reports
              .slice(-3)
              .reverse()
              .map((r) => (
                <article key={r.id}>
                  <strong>{r.reportingDate}</strong>
                  <p className="private-text">{r.body}</p>
                </article>
              ))}
          </section>
        );
      })}
      <section className="card">
        <label className="check">
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
