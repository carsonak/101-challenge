"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { Enrollment } from "../tracker-types";
import { Help } from "../ui";
import type { TrackerViewContext } from "./context";
/** Render season using current controller state and explicit actions. */
export function SeasonView(context: TrackerViewContext) {
  const { account, history, loaded, pages, run, season, view } = context;

  return (
    <>
      {view === "season" &&
        (season ? (
          <>
            <h1>{season.title}</h1>
            <p>{season.description}</p>
            <Help>
              Enrollment stays available, including for past seasons.
              Recommended goals are optional.
            </Help>
            {season.goals.length > 0 && (
              <ul>
                {season.goals.map((g, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: This read-only template list preserves server order.
                  <li key={i}>{g.title}</li>
                ))}
              </ul>
            )}
            {season.sessionUrl && (
              <a href={season.sessionUrl} rel="noreferrer">
                Community study sessions
              </a>
            )}
            {account ? (
              <button
                type="button"
                onClick={async () => {
                  const owned = history.find((e) => e.seasonId === season.id);
                  if (owned)
                    window.location.assign(
                      ["completed", "cancelled"].includes(owned.participation)
                        ? `/seasons/${season.slug}/setup`
                        : `/challenge/${owned.id}`
                    );
                  else if (
                    await run({ command: "Enroll", seasonId: season.id })
                  ) {
                    const current = await pages<Enrollment>("/api/v1/history");

                    const found = current.find((e) => e.seasonId === season.id);

                    if (found)
                      window.location.assign(`/seasons/${season.slug}/setup`);
                  }
                }}
                className={uiStyles.button}
              >
                {history.some((e) => e.seasonId === season.id)
                  ? ["cancelled", "completed"].includes(
                      history.find((e) => e.seasonId === season.id)
                        ?.participation ?? ""
                    )
                    ? "Retry"
                    : "Continue"
                  : "Join"}
              </button>
            ) : (
              <a className={uiStyles.button} href="/signup">
                Create an account to join
              </a>
            )}
          </>
        ) : (
          loaded && <p>This season is unavailable.</p>
        ))}{" "}
    </>
  );
}
