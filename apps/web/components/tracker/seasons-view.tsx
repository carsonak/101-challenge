"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Help } from "../ui";
import type { TrackerViewContext } from "./context";
/** Render seasons using current controller state and explicit actions. */
export function SeasonsView(context: TrackerViewContext) {
  const { seasons, loaded, view } = context;
  return (
    <>
      {view === "seasons" && (
        <>
          <h1>Choose a season</h1>
          <Help>
            Work toward 101 reporting days at your pace. Gaps affect streaks,
            rather than your total progress. You can keep one unfinished season
            active.
          </Help>
          {seasons.map((s) => (
            <article className={uiStyles.card} key={s.id}>
              <h2>
                <a href={`/seasons/${s.slug}`}>{s.title}</a>
                {s.featured && <span className={uiStyles.badge}>Featured</span>}
              </h2>
              <p>{s.description}</p>
            </article>
          ))}
          {loaded && !seasons.length && (
            <p>No published seasons are available yet.</p>
          )}
        </>
      )}{" "}
    </>
  );
}
