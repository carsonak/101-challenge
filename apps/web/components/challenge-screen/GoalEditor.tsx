"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { GoalInput } from "@challenge/core";
import { useState } from "react";
import { emptyGoal, GoalFields } from "../goal-fields";
import type { Attempt } from "../tracker-types";
/** Explicit active-attempt goal saves retain every revision rather than saving keystrokes. */
export function GoalEditor({
  attempt,
  goalId,
  run,
}: {
  attempt: Attempt;
  goalId?: string;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const existing = attempt.goals.find((g) => g.id === goalId),
    revision = attempt.goalRevisions.find(
      (r) => r.id === existing?.currentRevisionId
    );

  const [goal, setGoal] = useState<GoalInput>(
    revision?.input ?? { ...emptyGoal }
  );

  return (
    <form
      className={uiStyles.card}
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await run({
            command: "SaveGoal",
            attemptId: attempt.attemptId,
            expectedAttemptVersion: attempt.version,
            goalId,
            goal,
          })
        ) {
          if (!goalId) setGoal({ ...emptyGoal });
        }
      }}
    >
      <h4>{goalId ? "Revise goal" : "Add a goal"}</h4>
      <GoalFields value={goal} onChange={setGoal} />
      <button type="submit" className={uiStyles.button}>
        Save goal revision
      </button>
      {goalId && (
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          onClick={() =>
            run({
              command: "ArchiveGoal",
              attemptId: attempt.attemptId,
              expectedAttemptVersion: attempt.version,
              goalId,
            })
          }
        >
          Archive this goal
        </button>
      )}
    </form>
  );
}
