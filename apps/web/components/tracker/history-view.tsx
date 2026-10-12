"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { TrackerViewContext } from "./context";
/** Render history using current controller state and explicit actions. */
export function HistoryView(context: TrackerViewContext) {
  const { account, history, seasons, loaded, view } = context;
  return (
    <>
      {view === "history" && (
        <>
          <h1>Your history</h1>
          <p>Cancelled and restarted attempts stay here.</p>
          {!account && loaded ? (
            <a href="/login">Sign in to view your private history</a>
          ) : (
            history.map((e) => (
              <article className={uiStyles.card} key={e.id}>
                <h2>
                  <a href={`/challenge/${e.id}`}>
                    {seasons.find((s) => s.id === e.seasonId)?.title ??
                      "Challenge"}
                  </a>
                </h2>
                <p>
                  {e.participation} · {e.attempts.length} retained attempts
                  {e.hasCompleted ? " · Seasonal completion recorded" : ""}
                </p>
              </article>
            ))
          )}
        </>
      )}{" "}
    </>
  );
}
