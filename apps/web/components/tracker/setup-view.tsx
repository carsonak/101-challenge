"use client";
import { Setup } from "../setup-form";
import type { TrackerViewContext } from "./context";
/** Render setup using current controller state and explicit actions. */
export function SetupView(context: TrackerViewContext) {
  const { account, history, run, season, view } = context;
  return (
    <>
      {view === "setup" &&
        season &&
        account &&
        (() => {
          const e = history.find((e) => e.seasonId === season.id);
          const a = e?.attempts.find((a) => a.attemptId === e.currentAttemptId);

          return e ? (
            <>
              <h1>{season.title}: your plan</h1>
              <Setup
                key={e.id}
                enrollment={e}
                attempt={a}
                season={season}
                run={async (payload) => {
                  const ok = await run(payload);
                  if (ok) window.location.assign(`/challenge/${e.id}`);

                  return ok;
                }}
              />
            </>
          ) : (
            <a href={`/seasons/${season.slug}`}>Join this season first</a>
          );
        })()}{" "}
    </>
  );
}
