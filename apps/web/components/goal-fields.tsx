"use client";
import type { GoalInput, MilestoneInput } from "@challenge/core";
import { Field } from "./ui";

/** Empty optional goal editor. */
export const emptyGoal: GoalInput = { title: "", kind: "qualitative" };
/** Custom goal editor preserving decimal strings and explicit save boundaries. */
export function GoalFields({
  value,
  onChange,
}: {
  value: GoalInput;
  onChange: (goal: GoalInput) => void;
}) {
  return (
    <div className="form-grid">
      <Field label="Goal title">
        <input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="Description (optional)">
        <textarea
          maxLength={4000}
          value={value.description ?? ""}
          onChange={(e) =>
            onChange({ ...value, description: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="How you measure this goal">
        <select
          value={value.kind}
          onChange={(e) =>
            onChange({ ...value, kind: e.target.value as GoalInput["kind"] })
          }
        >
          <option value="qualitative">Describe your progress</option>
          <option value="count">Count</option>
          <option value="duration">Time</option>
          <option value="quantity">Quantity</option>
        </select>
      </Field>
      {value.kind !== "qualitative" && (
        <>
          <Field label="Target (optional)">
            <input
              inputMode="decimal"
              value={value.target ?? ""}
              onChange={(e) =>
                onChange({ ...value, target: e.target.value || undefined })
              }
            />
          </Field>
          <Field label="Unit (optional)">
            <input
              maxLength={40}
              value={value.unit ?? ""}
              onChange={(e) =>
                onChange({ ...value, unit: e.target.value || undefined })
              }
            />
          </Field>
          <small>
            Use up to 18 digits and six decimal places. Targets must be
            positive.
          </small>
        </>
      )}
    </div>
  );
}
/** Initial milestone fields shared by custom setup and optional season recommendations. */
export function InitialMilestoneFields({
  value,
  goals,
  onChange,
}: {
  value: MilestoneInput;
  goals: GoalInput[];
  onChange: (value: MilestoneInput) => void;
}) {
  return (
    <div className="form-grid">
      <Field label="Milestone title">
        <input
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="Milestone description (optional)">
        <textarea
          maxLength={4000}
          value={value.description ?? ""}
          onChange={(e) =>
            onChange({ ...value, description: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="Target reporting day">
        <input
          required
          type="number"
          min={1}
          max={101}
          value={value.targetReportingDay}
          onChange={(e) =>
            onChange({ ...value, targetReportingDay: Number(e.target.value) })
          }
        />
      </Field>
      <Field label="Achievement">
        <select
          value={value.achievementKind}
          onChange={(e) =>
            onChange({
              ...value,
              achievementKind: e.target
                .value as MilestoneInput["achievementKind"],
            })
          }
        >
          <option value="manual">I will report the achievement</option>
          <option value="reporting_count">Reach this reporting day</option>
        </select>
      </Field>
      <Field label="Associated initial goal (optional)">
        <select
          value={value.goalIndex ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              goalIndex:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        >
          <option value="">No associated goal</option>
          {goals.map((g, i) => (
            <option key={g.title || `goal-${i}`} value={i}>
              {i + 1}: {g.title || "Untitled goal"}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
