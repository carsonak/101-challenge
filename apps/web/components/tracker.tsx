"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FormEvent,
} from "react";
import type { createTracker, GoalInput, MilestoneInput } from "@challenge/core";
import {
  initialGoalSchema,
  initialMilestoneSchema,
  type accountSchema,
} from "@challenge/contracts";
import { Field, PasswordInput, Toast, Help } from "./ui";
import AccountScreen from "./account-screen";
import HomeScreen from "./home-screen";

/** Safe query types inferred from owner/admin service projections; all imports are type-only. */
type History = Awaited<ReturnType<ReturnType<typeof createTracker>["history"]>>;
/** One retained enrollment and its owned attempts. */
type Enrollment = History[number];
/** One owned attempt and retained definition/report projections. */
type Attempt = Enrollment["attempts"][number];
/** One deliberately published season template. */
type Season = Awaited<
  ReturnType<ReturnType<typeof createTracker>["seasons"]>
>[number];
/** Metadata-only administrator statistics. */
type Stats = Awaited<
  ReturnType<ReturnType<typeof createTracker>["adminStats"]>
>;
/** Owner-safe account settings, excluding proof and seed values. */
type Account = ReturnType<typeof accountSchema.parse>;
/** Editable custom goal; optional fields remain strings until validation. */
const emptyGoal: GoalInput = { title: "", kind: "qualitative" };
/** Read bounded API errors without displaying supplied or server-private values. */
async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.code ?? "UNAVAILABLE");
  return data;
}
/** Human explanations for stable errors; never echo raw server errors. */
const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in again.",
  FORBIDDEN: "This action requires permission or a recent sign-in.",
  NOT_FOUND: "This item is unavailable.",
  VALIDATION: "Check the fields and try again.",
  VERSION_CONFLICT:
    "The challenge changed. Your text is retained; review the latest progress before trying again.",
  ALREADY_REPORTED: "A report already exists for today. You can edit it below.",
  ATTEMPT_CLOSED:
    "This attempt is read-only. Historical edits require a correction key.",
  SEASON_SLOT_OCCUPIED:
    "You already have an unfinished active season. Cancel it before joining or resuming another.",
  MILESTONE_LOCKED:
    "That milestone is locked because its reporting day was accepted.",
  GRANT_INVALID:
    "The correction key is invalid, expired, revoked or already used.",
  IDEMPOTENCY_CONFLICT:
    "This retry differs from the original request. Review the latest progress.",
  RATE_LIMITED: "Too many requests. Please wait before trying again.",
};
/** Custom goal editor preserving decimal strings and explicit save boundaries. */
function GoalFields({
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
function InitialMilestoneFields({
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
/** Setup submits initial inputs once; restart explicitly retains history and expires credits. */
function Setup({
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
    <form onSubmit={submit} className="card">
      <h3>{attempt ? "Start a new attempt" : "Choose your initial goals"}</h3>
      <p>
        {attempt
          ? "Your previous attempts and reports stay in history. The new attempt starts at zero reporting days, and unspent credits from the previous attempt expire."
          : "Custom goals are equally welcome. Your timezone becomes fixed when you start."}
      </p>
      {season && season.goals.length > 0 && (
        <button
          type="button"
          className="secondary"
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
          className="secondary"
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
              className="secondary"
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
        className="secondary"
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
              className="secondary"
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
          className="secondary"
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
        <label className="check">
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
/** Report form keeps unsent text when validation, connectivity or version errors occur. */
function ReportForm({
  attempt,
  report,
  correction = false,
  backfill = false,
  earliest,
  run,
}: {
  attempt: Attempt;
  report?: Attempt["reports"][number];
  correction?: boolean;
  backfill?: boolean;
  earliest?: string;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const [date, setDate] = useState(report?.reportingDate ?? "");
  const [body, setBody] = useState(report?.body ?? ""),
    [key, setKey] = useState(""),
    [values, setValues] = useState<Record<string, string>>(
      Object.fromEntries(
        report?.goalValues.map((v) => [v.goalRevisionId, v.value]) ?? []
      )
    ),
    [achieved, setAchieved] = useState<string[]>([]);
  const activeGoals = attempt.goals
    .filter((g) => !g.archived)
    .map((g) => attempt.goalRevisions.find((r) => r.id === g.currentRevisionId))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const allowed = report
    ? attempt.goalRevisions.filter((r) =>
        report.applicableGoalRevisionIds.includes(r.id)
      )
    : activeGoals;
  /** Submit the explicit form draft without clearing it on errors. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const command = report
      ? {
          command: correction ? "CorrectReport" : "EditReport",
          reportId: report.id,
          expectedReportVersion: report.version,
          ...(correction
            ? { ...(key ? { key } : {}), reportingDate: date }
            : {}),
        }
      : {
          command: backfill ? "BackfillReport" : "SubmitReport",
          ...(backfill ? { reportingDate: date } : {}),
          attemptId: attempt.attemptId,
          expectedAttemptVersion: attempt.version,
          milestoneAchievements: achieved,
        };
    if (
      await run({
        ...command,
        body,
        goalValues: Object.entries(values)
          .filter(([, value]) => value !== "")
          .map(([goalRevisionId, value]) => ({ goalRevisionId, value })),
      })
    ) {
      if (!report) {
        setBody("");
        setValues({});
        setAchieved([]);
      }
      setKey("");
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h3>
        {report
          ? correction
            ? "Correct this report with a key"
            : "Edit today’s report"
          : backfill
            ? "Fill a skipped date"
            : "Today’s report"}
      </h3>
      <Help>
        A truthful report counts even when you did not work on your goals.
        Reports use your fixed local date.
      </Help>
      {(correction || backfill) && (
        <Field label="Reporting date">
          <select
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            <option value="">Choose an available date</option>
            {Array.from(
              {
                length: Math.max(
                  0,
                  Math.min(
                    36600,
                    Math.floor(
                      (Date.parse(attempt.today) -
                        Date.parse(
                          earliest ?? attempt.startedAt.slice(0, 10)
                        )) /
                        86400000
                    ) + 1
                  )
                ),
              },
              (_, i) =>
                new Date(
                  Date.parse(earliest ?? attempt.startedAt.slice(0, 10)) +
                    i * 86400000
                )
                  .toISOString()
                  .slice(0, 10)
            )
              .filter(
                (d) =>
                  !attempt.reports.some(
                    (r) => r.id !== report?.id && r.reportingDate === d
                  )
              )
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Your private report">
        <textarea
          required
          rows={5}
          minLength={1}
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      {allowed
        .filter((g) => g.input.kind !== "qualitative")
        .map((g) => (
          <Field
            key={g.id}
            label={`${g.input.title}${g.input.unit ? ` (${g.input.unit})` : ""}`}
          >
            <input
              inputMode="decimal"
              value={values[g.id] ?? ""}
              onChange={(e) => setValues({ ...values, [g.id]: e.target.value })}
            />
          </Field>
        ))}
      {!report &&
        attempt.milestones
          .filter((m) => !m.archived)
          .map((m) => ({
            m,
            revision: attempt.milestoneRevisions.find(
              (r) => r.id === m.currentRevisionId
            ),
          }))
          .filter(
            ({ revision }) =>
              revision?.input.targetReportingDay ===
                (backfill
                  ? attempt.reports.filter((r) => r.reportingDate < date)
                      .length + 1
                  : attempt.reportingDays + 1) &&
              revision.input.achievementKind === "manual"
          )
          .map(({ m, revision }) => (
            <label key={m.id} className="check">
              <input
                type="checkbox"
                checked={achieved.includes(m.id)}
                onChange={(e) =>
                  setAchieved(
                    e.target.checked
                      ? [...achieved, m.id]
                      : achieved.filter((id) => id !== m.id)
                  )
                }
              />
              I achieved: {revision?.input.title}
            </label>
          ))}
      {correction &&
        !(
          attempt.backfillUntil &&
          Date.parse(attempt.backfillUntil) > Date.now()
        ) && (
          <Field label="Correction key">
            <PasswordInput
              required

              autoComplete="off"
              minLength={64}
              maxLength={64}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
        )}
      <button type="submit">
        {report
          ? "Save report changes"
          : backfill
            ? "Save backdated report"
            : "Submit today’s report"}
      </button>
    </form>
  );
}
/** Explicit active-attempt goal saves retain every revision rather than saving keystrokes. */
function GoalEditor({
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
      className="card"
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
      <button type="submit">Save goal revision</button>
      {goalId && (
        <button
          type="button"
          className="secondary"
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
/** Future-report milestone editor; accepted target reports permanently lock revisions. */
function MilestoneEditor({
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
      className="card"
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
      <button type="submit">Save milestone revision</button>
      {milestoneId && (
        <button
          type="button"
          className="secondary"
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
/** One owned challenge, including retained closed attempts and controlled corrections. */
function Challenge({
  enrollment,
  season,
  run,
}: {
  enrollment: Enrollment;
  season?: Season;
  run: (payload: unknown) => Promise<boolean>;
}) {
  const current = enrollment.attempts.find(
    (a) => a.attemptId === enrollment.currentAttemptId
  );
  const [cancelName, setCancelName] = useState("");
  const [erase, setErase] = useState(false);
  const today = current?.reports.find((r) => r.reportingDate === current.today);
  return (
    <div className="challenge-layout">
      <h2>{season?.title ?? "Your challenge"}</h2>
      <p>
        Participation: <strong>{enrollment.participation}</strong> · Timezone:{" "}
        {enrollment.timezone ?? "Choose at setup"}
      </p>
      {current && (
        <div className="metrics">
          <div>
            <strong>{current.reportingDays}/101</strong>
            <span>Reporting days</span>
          </div>
          <div>
            <strong>{current.currentStreak}</strong>
            <span>Current streak</span>
          </div>
          <div>
            <strong>{current.longestStreak}</strong>
            <span>Longest streak</span>
          </div>
          <div>
            <strong>{current.rerollCredits}</strong>
            <span>Streak credits</span>
          </div>
        </div>
      )}
      {current && (
        <Help>
          Streak perk: every seven consecutive reporting days earns a credit.
          Earned credits survive gaps. Pausing or cancelling removes them.
        </Help>
      )}
      {current?.attemptState === "completed" && (
        <p className="notice">
          101 reporting days complete.{" "}
          {current.mode === "progress_only"
            ? "Your original seasonal completion stays fixed."
            : "Your seasonal completion is recorded."}
        </p>
      )}
      {!current && enrollment.participation === "active" && (
        <Setup enrollment={enrollment} season={season} run={run} />
      )}
      {current?.attemptState === "active" &&
        (!today ? (
          <ReportForm attempt={current} run={run} />
        ) : (
          <ReportForm
            key={today.id}
            attempt={current}
            report={today}
            run={run}
          />
        ))}
      {current?.backfillDeadline && (
        <section className="card">
          <h3>Backdated reports</h3>
          <p>
            Window ends {new Date(current.backfillDeadline).toLocaleString()}.
            Unfilled dates are skipped and do not count toward completion.
          </p>
          <details>
            <summary>Skipped dates (not counted)</summary>
            <ul>
              {Array.from(
                {
                  length: Math.max(
                    0,
                    Math.min(
                      36600,
                      Math.floor(
                        (Date.parse(current.backfillThrough) -
                          Date.parse(enrollment.earliestReportingDate)) /
                          86400000
                      ) + 1
                    )
                  ),
                },
                (_, i) =>
                  new Date(
                    Date.parse(enrollment.earliestReportingDate) + i * 86400000
                  )
                    .toISOString()
                    .slice(0, 10)
              )
                .filter(
                  (d) => !current.reports.some((r) => r.reportingDate === d)
                )
                .map((d) => (
                  <li key={d}>{d}</li>
                ))}
            </ul>
          </details>
          {current.backfillUntil &&
            Date.parse(current.backfillUntil) > Date.now() &&
            current.attemptState === "active" && (
              <ReportForm
                key={current.version}
                attempt={current}
                backfill
                earliest={enrollment.earliestReportingDate}
                run={run}
              />
            )}
        </section>
      )}
      {current?.attemptState === "completed" && today && (
        <ReportForm key={today.id} attempt={current} report={today} run={run} />
      )}
      {current && enrollment.participation === "active" && (
        <section className="card">
          <h3>Pause season</h3>
          <p>
            Pausing resets your streak and removes credits and active perks
            immediately. Another unfinished season can start on the next
            reporting day.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void run({
                command: "PauseEnrollment",
                enrollmentId: enrollment.id,
                expectedEnrollmentVersion: enrollment.version,
              })
            }
          >
            Pause
          </button>
        </section>
      )}
      {current && ["active", "paused"].includes(enrollment.participation) && (
        <form
          className="card danger-zone"
          onSubmit={(e) => {
            e.preventDefault();
            void run({
              command: "CancelEnrollment",
              enrollmentId: enrollment.id,
              expectedEnrollmentVersion: enrollment.version,
              seasonSlug: cancelName,
              erase,
            });
          }}
        >
          <h3>Cancel this attempt</h3>
          <p>
            Cancellation is immediate and cannot be undone. Incomplete artwork
            progress is removed. Earlier attempts and completed seasonal artwork
            are retained.
          </p>
          <Field label={`Type ${season?.slug} to confirm cancellation`}>
            <input
              required
              value={cancelName}
              onChange={(e) => setCancelName(e.target.value)}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={erase}
              onChange={(e) => setErase(e.target.checked)}
            />
            Also erase this attempt’s logs, goals and milestones
          </label>
          <button
            type="submit"
            className="danger"
            disabled={cancelName !== season?.slug}
          >
            Cancel season
          </button>
        </form>
      )}
      {enrollment.participation === "paused" && (
        <button
          type="button"
          onClick={() =>
            run({
              command: "ResumeEnrollment",
              enrollmentId: enrollment.id,
              expectedEnrollmentVersion: enrollment.version,
            })
          }
        >
          Resume enrollment
        </button>
      )}
      {current &&
        (current.attemptState === "active" ||
          current.attemptState === "completed" ||
          current.attemptState === "cancelled") && (
          <details className="card">
            <summary>Restart with new initial goals</summary>
            <Setup
              key={current.attemptId}
              enrollment={enrollment}
              attempt={current}
              season={season}
              run={run}
            />
          </details>
        )}
      {current && (
        <>
          <section>
            <h3>Goals and retained revisions</h3>
            {current.goals.map((g) => (
              <details key={g.id} className="card">
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
              <details key={m.id} className="card">
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
      )}
      {current && (
        <section className="attempt-sidebar">
          <h3>Previous attempts and logs</h3>
          {[...enrollment.attempts]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .map((a) => (
              <details key={a.attemptId} className="card">
                <summary>
                  {a.startedAt.slice(0, 10)} · {a.attemptState} ·{" "}
                  {a.reportingDays} reports ·{" "}
                  {a.mode === "progress_only" ? "Progress only" : "Qualifying"}
                </summary>
                {a.reports.map((r) => (
                  <article key={r.id} className="report">
                    <h4>
                      Day {r.reportingIndex} · {r.reportingDate}
                    </h4>
                    <p className="private-text">{r.body}</p>
                    <small>
                      Saved {r.createdAt} · Updated {r.updatedAt}
                    </small>
                    <details>
                      <summary>Use a correction key for this report</summary>
                      <ReportForm
                        attempt={a}
                        report={r}
                        correction
                        earliest={enrollment.earliestReportingDate}
                        run={run}
                      />
                    </details>
                  </article>
                ))}
              </details>
            ))}
        </section>
      )}
    </div>
  );
}
/** Browser account and participant/admin flows; private values are never persisted in browser storage. */
export default function TrackerScreen({
  view,
  id,
}: {
  view:
    | "login"
    | "signup"
    | "setup"
    | "home"
    | "notifications"
    | "account"
    | "seasons"
    | "season"
    | "challenge"
    | "history"
    | "admin-seasons"
    | "admin-corrections";
  id?: string;
}) {
  const [notifications, setNotifications] = useState<
    {
      id: string;
      message: string;
      href: string;
      createdAt: string;
      readAt: string | null;
    }[]
  >([]);
  const [account, setAccount] = useState<Account | null>(null),
    [csrf, setCsrf] = useState<string | undefined>(),
    [providers, setProviders] = useState({ google: false, discord: false }),
    [history, setHistory] = useState<History>([]),
    [seasons, setSeasons] = useState<Season[]>([]),
    [stats, setStats] = useState<Stats | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [rawKey, setRawKey] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  /** Load every stable page without sharing private responses through application caches. */
  const pages = useCallback(async <T,>(url: string): Promise<T[]> => {
    const result: T[] = [];
    let cursor: string | null = null;
    do {
      const data = await readResponse(
        await fetch(
          `${url}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          { cache: "no-store" }
        )
      );
      result.push(...data.items);
      cursor = data.nextCursor;
    } while (cursor);
    return result;
  }, []);
  /** Refresh session-scoped projections after a successful mutation or version conflict. */
  const refresh = useCallback(async () => {
    const context = await readResponse(
      await fetch("/api/v1/session", { cache: "no-store" })
    );
    setAccount(context.account);
    window.dispatchEvent(new Event("account-changed"));
    setCsrf(context.csrf ?? undefined);
    setProviders(context.providers);
    if (!["account", "notifications"].includes(view))
      setSeasons(
        await pages<Season>(
          context.account?.admin && view === "admin-seasons"
            ? "/api/v1/admin/seasons"
            : "/api/v1/seasons"
        )
      );
    if (context.account?.deletion) {
      setLoaded(true);
      if (view !== "account") window.location.replace("/account");
      return;
    }
    if (context.account?.provisional && view !== "account") {
      window.location.replace("/account");
      return;
    }
    if (!context.account && ["home", "notifications"].includes(view)) {
      window.location.replace("/login");
      return;
    }
    if (context.account) {
      if (view === "notifications")
        setNotifications(
          await readResponse(
            await fetch("/api/v1/notifications", { cache: "no-store" })
          )
        );
      if (["home", "challenge", "season", "setup", "history"].includes(view))
        setHistory(await pages<Enrollment>("/api/v1/history"));
      if (context.account.admin && view === "admin-corrections")
        setStats(
          await readResponse(
            await fetch("/api/v1/admin/stats", { cache: "no-store" })
          )
        );
    } else {
      setHistory([]);
      setStats(null);
    }
    setLoaded(true);
  }, [pages, view]);
  useEffect(() => {
    void refresh().catch(() => {
      setError(true);
      setMessage("The service is unavailable. Please try again shortly.");
      setLoaded(true);
    });
  }, [refresh]);
  /** Execute one idempotent command; text remains in child forms when a request fails. */
  async function run(payload: unknown): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    setRawKey("");
    const body = JSON.stringify(payload);
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    try {
      const result = await readResponse(
        await fetch("/api/v1/command", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
            "idempotency-key": pending.current.key,
          },
          body,
        })
      );
      pending.current = null;
      if ((payload as { command?: string }).command === "CreateSeason") {
        window.location.assign(`/admin/seasons/${result.resourceId}`);
        return true;
      }
      setError(false);
      setMessage("Saved.");
      if (result.rawKey) setRawKey(result.rawKey);
      await refresh();
      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "UNAVAILABLE";
      setError(true);
      setMessage(
        errorMessages[code] ??
          "The request could not be completed. Your text is retained; try again."
      );
      if (["VERSION_CONFLICT", "ALREADY_REPORTED"].includes(code))
        await refresh().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  }
  /** Cookie-backed account mutations validate CSRF at the server and keep errors safe. */
  async function authAction(payload: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const result = await readResponse(
        await fetch("/api/v1/auth", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
          },
          body: JSON.stringify(payload),
        })
      );
      if ((payload as { action?: string }).action === "reauthenticate")
        return true;
      if (result.requestId) {
        window.location.assign("/login");
        return true;
      }
      setError(false);
      setMessage(
        ["add_email", "recovery_email"].includes(
          (payload as { action: string }).action
        )
          ? "Check your email for the verification link."
          : "Saved."
      );
      await refresh();
      return true;
    } catch (e) {
      setError(true);
      setMessage(
        errorMessages[e instanceof Error ? e.message : ""] ??
          "The request could not be completed. Please try again."
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  /** Start only the configured provider flow with server-bound browser state. */
  async function oauth(provider: "google" | "discord", link: boolean) {
    try {
      const data = await readResponse(
        await fetch("/api/v1/oauth", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
          },
          body: JSON.stringify({ provider, link }),
        })
      );
      window.location.assign(data.url);
    } catch {
      setError(true);
      setMessage(
        "This sign-in method is unavailable or requires a recent sign-in."
      );
    }
  }
  useEffect(() => {
    const match = seasons.find((s) => s.id === id);
    if (view === "season" && match)
      window.location.replace(`/seasons/${match.slug}`);
  }, [seasons, id, view]);
  const dismiss = useCallback(() => setMessage(""), []);
  const chosen = history.find((e) => e.id === id);
  const season = seasons.find((s) => s.id === id || s.slug === id);
  return (
    <main className="tracker">
      <Toast message={message} error={error} dismiss={dismiss} />
      <fieldset className="screen" disabled={busy}>
        <legend className="sr-only">Challenge controls</legend>
        {view === "seasons" && (
          <>
            <h1>Choose a season</h1>
            <Help>
              Work toward 101 reporting days at your pace. Gaps affect streaks,
              rather than your total progress. You can keep one unfinished
              season active.
            </Help>
            {seasons.map((s) => (
              <article className="card" key={s.id}>
                <h2>
                  <a href={`/seasons/${s.slug}`}>{s.title}</a>
                  {s.featured && <span className="badge">Featured</span>}
                </h2>
                <p>{s.description}</p>
              </article>
            ))}
            {loaded && !seasons.length && (
              <p>No published seasons are available yet.</p>
            )}
          </>
        )}
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
                      const current =
                        await pages<Enrollment>("/api/v1/history");
                      const found = current.find(
                        (e) => e.seasonId === season.id
                      );
                      if (found)
                        window.location.assign(`/seasons/${season.slug}/setup`);
                    }
                  }}
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
                <a className="button" href="/signup">
                  Create an account to join
                </a>
              )}
            </>
          ) : (
            loaded && <p>This season is unavailable.</p>
          ))}
        {view === "history" && (
          <>
            <h1>Your history</h1>
            <p>Cancelled and restarted attempts stay here.</p>
            {!account && loaded ? (
              <a href="/login">Sign in to view your private history</a>
            ) : (
              history.map((e) => (
                <article className="card" key={e.id}>
                  <h2>
                    <a href={`/challenge/${e.id}`}>
                      {seasons.find((s) => s.id === e.seasonId)?.title ??
                        "Challenge"}
                    </a>
                  </h2>
                  <p>
                    {e.participation} · {e.attempts.length} retained attempts
                    {e.hasCompleted ? " · Seasonal completion recorded" : ""}
                  </p>
                </article>
              ))
            )}
          </>
        )}
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
          ))}
        {view === "account" &&
          (account ? (
            <AccountScreen
              account={account}
              providers={providers}
              act={authAction}
              oauth={oauth}
            />
          ) : (
            loaded && <a href="/login">Log in to view your account</a>
          ))}
        {view === "setup" &&
          season &&
          account &&
          (() => {
            const e = history.find((e) => e.seasonId === season.id);
            const a = e?.attempts.find(
              (a) => a.attemptId === e.currentAttemptId
            );
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
          })()}
        {view === "home" && account && (
          <HomeScreen history={history} seasons={seasons} />
        )}
        {view === "notifications" && (
          <>
            <h1>Notifications</h1>
            {notifications.length ? (
              notifications.map((n) => (
                <article className="card" key={n.id}>
                  <a href={n.href}>{n.message}</a>
                  <p>
                    {new Date(n.createdAt).toLocaleString()}
                    {!n.readAt && " · Unread"}
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void authAction({ action: "notification", id: n.id })
                    }
                  >
                    Mark read
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void authAction({
                        action: "notification",
                        id: n.id,
                        dismiss: true,
                      })
                    }
                  >
                    Dismiss
                  </button>
                </article>
              ))
            ) : (
              <p>You’re all caught up.</p>
            )}
          </>
        )}
        {view === "admin-seasons" && (
          <>
            <h1>Manage seasons</h1>
            {account?.admin ? (
              <>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run({
                      command: "CreateSeason",
                      title: data.get("title"),
                      slug: data.get("slug"),
                      description: data.get("description") || undefined,
                    });
                  }}
                >
                  <Field label="Season URL identifier">
                    <input
                      required
                      name="slug"
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Season title">
                    <input required name="title" maxLength={200} />
                  </Field>
                  <Field label="Season description">
                    <textarea name="description" maxLength={4000} />
                  </Field>
                  <button type="submit">Create draft season</button>
                </form>
                <div className="columns">
                  <aside className="sidebar" aria-label="Season editor list">
                    {seasons.map((s) => (
                      <a key={s.id} href={`/admin/seasons/${s.id}`}>
                        {s.title} · {s.state}
                        {s.featured ? " · Featured" : ""}
                      </a>
                    ))}
                  </aside>
                  <div>
                    {seasons
                      .filter((s) => s.id === id)
                      .map((s) => (
                        <article className="card" key={s.id}>
                          <h2>{s.title}</h2>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const d = new FormData(e.currentTarget);
                              void run({
                                command: "SaveSeason",
                                seasonId: s.id,
                                expectedSeasonVersion: s.version,
                                title: d.get("title"),
                                description: d.get("description"),
                                slug: d.get("slug"),
                                ...(!s.publishedAt &&
                                s.state === "published" &&
                                d.get("publishedAt")
                                  ? {
                                      publishedAt: new Date(
                                        String(d.get("publishedAt"))
                                      ).toISOString(),
                                    }
                                  : {}),
                              });
                            }}
                          >
                            <Field label="Season title">
                              <input
                                required
                                name="title"
                                defaultValue={s.title}
                                maxLength={200}
                              />
                            </Field>
                            <Field label="Description">
                              <textarea
                                name="description"
                                defaultValue={s.description ?? ""}
                                maxLength={4000}
                              />
                            </Field>
                            <Field label="URL identifier">
                              <input
                                required
                                name="slug"
                                defaultValue={s.slug}
                                readOnly={s.state === "published"}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                              />
                            </Field>
                            {!s.publishedAt && s.state === "published" && (
                              <Field label="Verified first publication instant (UTC)">
                                <input
                                  type="datetime-local"
                                  name="publishedAt"
                                />
                              </Field>
                            )}
                            <button type="submit">Save season details</button>
                          </form>
                          <p>
                            {s.state} ·{" "}
                            {s.featured ? "Featured" : "Not featured"}
                          </p>
                          {s.state === "draft" && (
                            <button
                              type="button"
                              onClick={() =>
                                run({
                                  command: "PublishSeason",
                                  seasonId: s.id,
                                  expectedSeasonVersion: s.version,
                                })
                              }
                            >
                              Publish {s.title}
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              run({
                                command: "SetSeasonFeatured",
                                seasonId: s.id,
                                expectedSeasonVersion: s.version,
                                featured: !s.featured,
                              })
                            }
                          >
                            {s.featured
                              ? "Remove from featured"
                              : "Feature this season"}
                          </button>
                          <SeasonTemplate key={s.id} season={s} run={run} />
                        </article>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              loaded && <p>Administrator permission is required.</p>
            )}
          </>
        )}
        {view === "admin-corrections" && (
          <>
            <h1>Correction grants</h1>
            <p>
              Grant keys let owners correct existing reports and eligible dates.
              Existing completion entitlements remain fixed.
            </p>
            {account?.admin && stats ? (
              <>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void run({
                      command: "BackdateEnrollment",
                      userId: d.get("userId"),
                      seasonId: d.get("seasonId"),
                      registeredDate: d.get("date"),
                    });
                  }}
                >
                  <h2>Backdated participation</h2>
                  <Field label="Participant">
                    <select name="userId" required>
                      {stats.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Season">
                    <select required name="seasonId">
                      {seasons
                        .filter((s) => s.publishedAt)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Effective registration date">
                    <input required name="date" type="date" />
                  </Field>
                  <p>
                    The participant has 24 hours to fill missing reports.
                    Unfilled dates do not count.
                  </p>
                  <button type="submit">Create backdated participation</button>
                </form>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const kind = data.get("kind");
                    void run(
                      kind === "single_report"
                        ? {
                            command: "IssueCorrectionGrant",
                            kind,
                            reportId: data.get("reportId"),
                          }
                        : {
                            command: "IssueCorrectionGrant",
                            kind: "attempt_window",
                            attemptId: data.get("attemptId"),
                            durationMinutes: Number(data.get("minutes")),
                          }
                    );
                  }}
                >
                  <Field label="Grant scope">
                    <select name="kind">
                      <option value="single_report">
                        One report, one use, expires in 24 hours
                      </option>
                      <option value="attempt_window">
                        Attempt window, up to one hour
                      </option>
                    </select>
                  </Field>
                  <Field label="Report">
                    <select name="reportId">
                      {stats.reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          Day {r.reportingIndex} · {r.reportingDate} · {r.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Attempt">
                    <select name="attemptId">
                      {stats.attempts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.startedAt} · {a.reportingDays} reports · {a.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Window minutes">
                    <input
                      name="minutes"
                      type="number"
                      min={1}
                      max={60}
                      defaultValue={60}
                    />
                  </Field>
                  <button type="submit">Issue correction key</button>
                </form>
                {rawKey && (
                  <div className="notice">
                    <p>
                      Copy this key now and give it privately to the owner. It
                      is shown once.
                    </p>
                    <output className="key">{rawKey}</output>
                  </div>
                )}
                {stats.grants.map((g) => (
                  <article key={g.id} className="card">
                    <p>
                      {g.kind} · Expires {g.expiresAt} ·{" "}
                      {g.usedAt
                        ? "Used"
                        : g.revokedAt
                          ? "Revoked"
                          : "Available"}
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      disabled={Boolean(g.usedAt || g.revokedAt)}
                      onClick={() =>
                        run({ command: "RevokeCorrectionGrant", grantId: g.id })
                      }
                    >
                      Revoke grant {g.id}
                    </button>
                  </article>
                ))}
                <h2>Metadata</h2>
                {stats.attempts.map((a) => (
                  <p key={a.id}>
                    {a.id} · {a.status} · {a.reportingDays} reports · Streak{" "}
                    {a.currentStreak}, longest {a.longestStreak} ·{" "}
                    {a.rerollCredits} credits
                  </p>
                ))}
              </>
            ) : (
              loaded && <p>Administrator permission is required.</p>
            )}
          </>
        )}
      </fieldset>
      {!loaded && <p role="status">Loading…</p>}
    </main>
  );
}
/** Optional recommended season setup; no participant needs to adopt this template. */
function SeasonTemplate({
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
