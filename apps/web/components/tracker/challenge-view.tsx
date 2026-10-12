"use client";
import { Challenge } from "../challenge-screen";
import type { TrackerViewContext } from "./context";
/** Render challenge using current controller state and explicit actions. */
export function ChallengeView(context: TrackerViewContext) {
  const { seasons, loaded, run, chosen, view } = context;
  return (
    <>
      {view === "challenge" &&
        (chosen ? (
          <Challenge
            enrollment={chosen}
            season={seasons.find((s) => s.id === chosen.seasonId)}
            run={run}
          />
        ) : (
          loaded && (
            <p>
              This challenge is unavailable.{" "}
              <a href="/history">Return to your history</a>.
            </p>
          )
        ))}{" "}
    </>
  );
}
