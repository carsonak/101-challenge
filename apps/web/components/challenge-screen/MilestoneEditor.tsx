"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { MilestoneInput } from "@challenge/core";
import { useState } from "react";
import type { Attempt } from "../tracker-types";
import { Field } from "../ui";
/** Future-report milestone editor; accepted target reports permanently lock revisions. */
export function MilestoneEditor({
  attempt,
  milestoneId,
  run,
}: {
  attempt: Attempt;
  milestoneId?: string;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const milestone = attempt.milestones.find((m) => m.id === milestoneId),
    revision = attempt.milestoneRevisions.find(
      (r) => r.id === milestone?.currentRevisionId
    );

  const [value, setValue] = useState<MilestoneInput & { goalId?: string }>(
    revision?.input ?? {
      title: "",
      targetReportingDay: Math.min(101, attempt.reportingDays + 7),
      achievementKind: "manual" as const,
    }
  );

  return (
    <form
      className={uiStyles.card}
      onSubmit={async (e) => {
        e.preventDefault();
        await run({
          command: "SaveMilestone",
          attemptId: attempt.attemptId,
          expectedAttemptVersion: attempt.version,
          milestoneId,
          milestone: value,
        });
      }}
    >
      <h4>{milestoneId ? "Revise milestone" : "Add a milestone"}</h4>
      <Field label="Milestone title">
        <input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="Milestone description (optional)">
        <textarea
          maxLength={4000}
          value={value.description ?? ""}
          onChange={(e) =>
            setValue({ ...value, description: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="Target reporting day">
        <input
          required
          type="number"
          min={attempt.reportingDays + 1}
          max={101}
          value={value.targetReportingDay}
          onChange={(e) =>
            setValue({ ...value, targetReportingDay: Number(e.target.value) })
          }
        />
      </Field>
      <Field label="Achievement">
        <select
          value={value.achievementKind}
          onChange={(e) =>
            setValue({
              ...value,
              achievementKind: e.target.value as "manual" | "reporting_count",
            })
          }
        >
          <option value="manual">I will report the achievement</option>
          <option value="reporting_count">Reach this reporting day</option>
        </select>
      </Field>
      <Field label="Associated goal (optional)">
        <select
          value={value.goalId ?? ""}
          onChange={(e) =>
            setValue({ ...value, goalId: e.target.value || undefined })
          }
        >
          <option value="">No associated goal</option>
          {attempt.goals
            .filter((g) => !g.archived)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {
                  attempt.goalRevisions.find(
                    (r) => r.id === g.currentRevisionId
                  )?.input.title
                }
              </option>
            ))}
        </select>
      </Field>
      <button type="submit" className={uiStyles.button}>
        Save milestone revision
      </button>
      {milestoneId && (
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          onClick={() =>
            run({
              command: "ArchiveMilestone",
              attemptId: attempt.attemptId,
              expectedAttemptVersion: attempt.version,
              milestoneId,
            })
          }
        >
          Archive this milestone
        </button>
      )}
    </form>
  );
}
