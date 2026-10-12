"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Help } from "../ui";
import { GoalEditor } from "./GoalEditor";
import { MilestoneEditor } from "./MilestoneEditor";

import type { ScreenContext } from "./context";
/** Revisions section preserves its existing controls and state. */
export function Revisions(context: ScreenContext) {
  const { run, current } = context;
  return (
    <>
      {current && (
        <>
          <section>
            <h3>Goals and retained revisions</h3>
            {current.goals.map((g) => (
              <details key={g.id} className={uiStyles.card}>
                <summary>
                  {
                    current.goalRevisions.find(
                      (r) => r.id === g.currentRevisionId
                    )?.input.title
                  }
                  {g.archived ? " (archived)" : ""}
                </summary>
                {current.goalRevisions
                  .filter((r) => r.goalId === g.id)
                  .map((r) => (
                    <div key={r.id}>
                      <p>
                        <strong>{r.input.title}</strong> · Saved {r.createdAt}
                      </p>
                      <p>{r.input.description}</p>
                    </div>
                  ))}
                {(current.attemptState === "active" ||
                  Boolean(current.backfillUntil)) &&
                  !g.archived && (
                    <GoalEditor attempt={current} goalId={g.id} run={run} />
                  )}
              </details>
            ))}
            {current.attemptState === "active" && current.goals.length < 20 && (
              <GoalEditor attempt={current} run={run} />
            )}
          </section>
          <section>
            <h3>Milestones</h3>
            <Help>
              Milestones lock when their reporting day is accepted, rather than
              on a calendar deadline.
            </Help>
            {current.milestones.map((m) => (
              <details key={m.id} className={uiStyles.card}>
                <summary>
                  {
                    current.milestoneRevisions.find(
                      (r) => r.id === m.currentRevisionId
                    )?.input.title
                  }
                  {m.locked ? " (locked)" : m.archived ? " (archived)" : ""}
                </summary>
                {current.milestoneRevisions
                  .filter((r) => r.milestoneId === m.id)
                  .map((r) => (
                    <p key={r.id}>
                      Reporting day {r.input.targetReportingDay}:{" "}
                      {r.input.title} · {r.createdAt}
                    </p>
                  ))}
                {(current.attemptState === "active" ||
                  Boolean(current.backfillUntil)) &&
                  (!m.locked ||
                    Boolean(
                      current.backfillUntil &&
                      Date.parse(current.backfillUntil) > Date.now()
                    )) &&
                  !m.archived && (
                    <MilestoneEditor
                      attempt={current}
                      milestoneId={m.id}
                      run={run}
                    />
                  )}
              </details>
            ))}
            {current.attemptState === "active" &&
              current.reportingDays < 101 &&
              current.milestones.length < 101 && (
                <MilestoneEditor attempt={current} run={run} />
              )}
          </section>
        </>
      )}{" "}
    </>
  );
}
