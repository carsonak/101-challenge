"use client";
import uiStyles from "./../styles/ui.module.css";

import { useState, type FormEvent } from "react";
import type { GoalInput, MilestoneInput } from "@challenge/core";
import {
  initialGoalSchema,
  initialMilestoneSchema,
} from "@challenge/contracts";
import { Help } from "./ui";
import type { Enrollment, Attempt, Season } from "./tracker-types";
import { emptyGoal, GoalFields, InitialMilestoneFields } from "./goal-fields";
/** Setup submits initial inputs once; restart explicitly retains history and expires credits. */
export function Setup({
  enrollment,
  attempt,
  season,
  run,
}: {
  enrollment: Enrollment;
  attempt?: Attempt;
  season?: Season;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const [goals, setGoals] = useState<GoalInput[]>(
      season?.goals.length
        ? season.goals.map((g) => ({ ...g }))
        : [{ ...emptyGoal }]
    ),
    [milestones, setMilestones] = useState<MilestoneInput[]>(
      season?.milestones.map((m) => ({ ...m })) ?? []
    ),
    [confirmed, setConfirmed] = useState(false);

  /** Submit the explicit form draft without clearing it on errors. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      command: attempt ? "RestartAttempt" : "StartAttempt",
      enrollmentId: enrollment.id,
      expectedEnrollmentVersion: enrollment.version,

      goals,
      milestones,
      ...(attempt
        ? {
            attemptId: attempt.attemptId,
            expectedAttemptVersion: attempt.version,
            confirmed,
          }
        : {}),
    };

    await run(payload);
  }

  return (
    <form onSubmit={submit} className={uiStyles.card}>
      <h3>{attempt ? "Start a new attempt" : "Choose your initial goals"}</h3>
      <p>
        {attempt
          ? "Your previous attempts and reports stay in history. The new attempt starts at zero reporting days, and unspent credits from the previous attempt expire."
          : "Custom goals are equally welcome. Your timezone becomes fixed when you start."}
      </p>
      <p>
        Your reporting days follow{" "}
        <strong>{enrollment.reportingTimezone}</strong>, including while
        travelling. The day changes at midnight there. This timezone is fixed
        when your first attempt starts.
      </p>
      {season && season.goals.length > 0 && (
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          onClick={() => {
            setGoals(season.goals.map((g) => ({ ...g })));
            setMilestones(season.milestones.map((m) => ({ ...m })));
          }}
        >
          Apply season plan
        </button>
      )}
      {attempt && (
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          onClick={() => {
            setGoals(
              attempt.goals
                .filter((g) => !g.archived)
                .map(
                  (g) =>
                    attempt.goalRevisions.find(
                      (r) => r.id === g.currentRevisionId
                    )?.input ?? { ...emptyGoal }
                )
            );
          }}
        >
          Copy current goals
        </button>
      )}
      {goals.map((goal, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Controlled form rows have no independent state; deletion is explicit.
        <fieldset key={index}>
          <legend>Goal {index + 1}</legend>
          <GoalFields
            value={goal}
            onChange={(updated) =>
              setGoals(goals.map((g, i) => (i === index ? updated : g)))
            }
          />
          {goals.length > 0 && (
            <button
              type="button"
              className={`${uiStyles.button} ${uiStyles.secondary}`}
              onClick={() => {
                setGoals(goals.filter((_, i) => i !== index));
                setMilestones(
                  milestones.map((m) => ({
                    ...m,
                    goalIndex:
                      m.goalIndex === index
                        ? undefined
                        : m.goalIndex !== undefined && m.goalIndex > index
                          ? m.goalIndex - 1
                          : m.goalIndex,
                  }))
                );
              }}
            >
              Remove
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        className={`${uiStyles.button} ${uiStyles.secondary}`}
        disabled={goals.length >= 20}
        onClick={() => setGoals([...goals, { ...emptyGoal }])}
      >
        Add another goal
      </button>
      <details>
        <summary>Initial milestones (optional)</summary>
        {milestones.map((m, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Controlled form rows have no independent state; deletion is explicit.
          <fieldset key={index}>
            <legend>Milestone {index + 1}</legend>
            <InitialMilestoneFields
              value={m}
              goals={goals}
              onChange={(updated) =>
                setMilestones(
                  milestones.map((v, i) => (i === index ? updated : v))
                )
              }
            />
            <button
              className={`${uiStyles.button} ${uiStyles.secondary}`}
              type="button"
              onClick={() =>
                setMilestones(milestones.filter((_, i) => i !== index))
              }
            >
              Remove milestone {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          disabled={milestones.length >= 101}
          onClick={() =>
            setMilestones([
              ...milestones,
              { title: "", targetReportingDay: 7, achievementKind: "manual" },
            ])
          }
        >
          Add initial milestone
        </button>
      </details>
      {attempt && (
        <label className={uiStyles.check}>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this new attempt and the expiry of previous credits.
        </label>
      )}
      <div title="Add at least one goal and fill all required fields.">
        <button
          type="submit"
          disabled={
            !goals.length ||
            !goals.every((g) => initialGoalSchema.safeParse(g).success) ||
            !milestones.every(
              (m) => initialMilestoneSchema.safeParse(m).success
            ) ||
            (Boolean(attempt) && !confirmed)
          }
          className={uiStyles.button}
        >
          {attempt ? "Restart with these goals" : "Start my challenge"}
        </button>
        <Help>
          Add at least one goal and fill all required fields to start. Confirm
          the restart when beginning another attempt.
        </Help>
      </div>
    </form>
  );
}
