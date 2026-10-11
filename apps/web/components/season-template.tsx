"use client";
import { useState } from "react";
import type { GoalInput, MilestoneInput } from "@challenge/core";
import { Field } from "./ui";
import type { Season } from "./tracker-types";
import { emptyGoal, GoalFields, InitialMilestoneFields } from "./goal-fields";
/** Optional recommended season setup; no participant needs to adopt this template. */
export function SeasonTemplate({
  season,
  run,
}: {
  season: Season;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const [goals, setGoals] = useState<GoalInput[]>(season.goals),
    [url, setUrl] = useState(season.sessionUrl ?? ""),
    [milestones, setMilestones] = useState<MilestoneInput[]>(season.milestones);
  return (
    <details>
      <summary>Recommended plan and study sessions</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            command: "SaveSeasonTemplate",
            seasonId: season.id,
            expectedSeasonVersion: season.version,
            goals,
            milestones,
            sessionUrl: url || undefined,
          });
        }}
      >
        <h3>Goals</h3>
        {goals.map((goal, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Controlled template rows have no independent state.
          <fieldset key={i}>
            <legend>Recommended goal {i + 1}</legend>
            <GoalFields
              value={goal}
              onChange={(updated) =>
                setGoals(goals.map((g, index) => (index === i ? updated : g)))
              }
            />
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setGoals(goals.filter((_, index) => index !== i));
                setMilestones(
                  milestones.map((m) => ({
                    ...m,
                    goalIndex:
                      m.goalIndex === i
                        ? undefined
                        : m.goalIndex !== undefined && m.goalIndex > i
                          ? m.goalIndex - 1
                          : m.goalIndex,
                  }))
                );
              }}
            >
              Remove
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={goals.length >= 20}
          onClick={() => setGoals([...goals, { ...emptyGoal }])}
        >
          Add recommended goal
        </button>
        <h3>Milestones</h3>
        {!milestones.length && <p>No recommended milestones yet.</p>}
        {milestones.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Controlled form rows have no independent state.
          <fieldset key={`${season.id}-milestone-${i}`}>
            <legend>Recommended milestone {i + 1}</legend>
            <InitialMilestoneFields
              value={m}
              goals={goals}
              onChange={(updated) =>
                setMilestones(
                  milestones.map((v, index) => (index === i ? updated : v))
                )
              }
            />
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setMilestones(milestones.filter((_, index) => index !== i))
              }
            >
              Remove
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={milestones.length >= 101}
          onClick={() =>
            setMilestones([
              ...milestones,
              { title: "", targetReportingDay: 7, achievementKind: "manual" },
            ])
          }
        >
          Add recommended milestone
        </button>
        <Field label="Study-session link (optional)">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <button type="submit">Save recommended plan</button>
      </form>
    </details>
  );
}
