"use client";

import {
  useEffect,
  useRef,
  useState,
  useId,
  useCallback,
  type FormEvent,
  cloneElement,
  type ReactElement,
} from "react";
import type { createTracker, GoalInput, MilestoneInput } from "@challenge/core";
import type { accountSchema } from "@challenge/contracts";

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
/** Named field with an accessible label; descriptions remain visible beside inputs. */
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
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
  const [goals, setGoals] = useState<GoalInput[]>([{ ...emptyGoal }]),
    [milestones, setMilestones] = useState<MilestoneInput[]>([]),
    [zone, setZone] = useState(
      enrollment.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    ),
    [confirmed, setConfirmed] = useState(false);
  const listId = useId();
  /** Submit the explicit form draft without clearing it on errors. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      command: attempt ? "RestartAttempt" : "StartAttempt",
      enrollmentId: enrollment.id,
      expectedEnrollmentVersion: enrollment.version,
      timezone: zone,
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
          Copy the recommended plan
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
          {goals.length > 1 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setGoals(goals.filter((_, i) => i !== index))}
            >
              Remove goal {index + 1}
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
      <Field label="Reporting timezone">
        <input
          required
          readOnly={Boolean(enrollment.timezone)}
          list={listId}
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        />
      </Field>
      <datalist id={listId}>
        {[
          "Africa/Nairobi",
          "UTC",
          "America/New_York",
          "Europe/London",
          "Asia/Tokyo",
        ].map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
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
      <button type="submit">
        {attempt ? "Restart with these goals" : "Start my challenge"}
      </button>
    </form>
  );
}
/** Report form keeps unsent text when validation, connectivity or version errors occur. */
function ReportForm({
  attempt,
  report,
  correction = false,
  run,
}: {
  attempt: Attempt;
  report?: Attempt["reports"][number];
  correction?: boolean;
  run: (payload: unknown) => Promise<boolean>;
}) {
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
          ...(correction ? { key } : {}),
        }
      : {
          command: "SubmitReport",
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
          : "Today’s report"}
      </h3>
      <p>
        A truthful report counts even when you did not work on your goals.
        Reports use your fixed local date.
      </p>
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
                attempt.reportingDays + 1 &&
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
      {correction && (
        <Field label="Correction key">
          <input
            required
            type="password"
            autoComplete="off"
            minLength={64}
            maxLength={64}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
      )}
      <button type="submit">
        {report ? "Save report changes" : "Submit today’s report"}
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
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const today = current?.reports.find((r) => r.reportingDate === current.today);
  return (
    <>
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
        <p>
          Streak perk: every seven consecutive reporting days earns a credit.
          Earned credits survive gaps and cancellation.
        </p>
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
      {current?.attemptState === "completed" && today && (
        <ReportForm key={today.id} attempt={current} report={today} run={run} />
      )}
      {enrollment.participation === "active" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (cancelConfirmed)
              void run({
                command: "CancelEnrollment",
                enrollmentId: enrollment.id,
                expectedEnrollmentVersion: enrollment.version,
              });
          }}
        >
          <h3>Pause participation</h3>
          <p>
            Cancellation retains your reports and credits and frees your
            unfinished-season slot. Resume continues the same attempt.
          </p>
          <label className="check">
            <input
              type="checkbox"
              required
              checked={cancelConfirmed}
              onChange={(e) => setCancelConfirmed(e.target.checked)}
            />
            Cancel this enrollment and retain its history.
          </label>
          <button className="secondary" type="submit">
            Cancel enrollment
          </button>
        </form>
      )}
      {enrollment.participation === "cancelled" && (
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
          current.attemptState === "completed") && (
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
                {current.attemptState === "active" && !g.archived && (
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
            <p>
              Milestones lock when their reporting day is accepted, rather than
              on a calendar deadline.
            </p>
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
                {current.attemptState === "active" &&
                  !m.locked &&
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
      <section>
        <h3>Retained attempt history</h3>
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
                    <ReportForm attempt={a} report={r} correction run={run} />
                  </details>
                </article>
              ))}
            </details>
          ))}
      </section>
    </>
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
    | "account"
    | "seasons"
    | "season"
    | "challenge"
    | "history"
    | "admin-seasons"
    | "admin-corrections";
  id?: string;
}) {
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
    [rawKey, setRawKey] = useState(""),
    [query, setQuery] = useState(new URLSearchParams());
  const notice = useRef<HTMLDivElement>(null);
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
    setCsrf(context.csrf ?? undefined);
    setProviders(context.providers);
    setSeasons(
      await pages<Season>(
        context.account?.admin && view === "admin-seasons"
          ? "/api/v1/admin/seasons"
          : "/api/v1/seasons"
      )
    );
    if (context.account) {
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
    setQuery(new URLSearchParams(window.location.search));
    void refresh().catch(() => {
      setError(true);
      setMessage("The service is unavailable. Please try again shortly.");
      setLoaded(true);
    });
  }, [refresh]);
  useEffect(() => {
    if (message) notice.current?.focus();
  }, [message]);
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
      setError(false);
      setMessage(
        result.requestId
          ? "Your account erasure request has been recorded."
          : "Request accepted. Check your private email when a verification or recovery link is needed."
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
  const chosen = history.find((e) => e.id === id);
  const season = seasons.find((s) => s.id === id);
  return (
    <main className="tracker">
      <nav aria-label="Challenge navigation">
        <a href="/">Home</a>
        <a href="/seasons">Seasons</a>
        {account ? (
          <>
            <a href="/history">History</a>
            <a href="/account">Account</a>
            {account.admin && (
              <>
                <a href="/admin/seasons">Manage seasons</a>
                <a href="/admin/corrections">Correction grants</a>
              </>
            )}
          </>
        ) : (
          <>
            <a href="/login">Sign in</a>
            <a href="/signup">Create account</a>
          </>
        )}
      </nav>
      <div
        ref={notice}
        tabIndex={-1}
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        className={message ? (error ? "notice error" : "notice") : ""}
      >
        {message}
      </div>
      <fieldset className="screen" disabled={busy}>
        <legend className="sr-only">Challenge controls</legend>
        {(view === "login" || view === "signup") && (
          <>
            <h1>{view === "signup" ? "Create your account" : "Sign in"}</h1>
            {account ? (
              <p>
                You are signed in. <a href="/account">Open account settings</a>.
              </p>
            ) : (
              <>
                <form
                  className="card"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    if (
                      await authAction({
                        action: view,
                        email: data.get("email"),
                        password: data.get("password"),
                      })
                    ) {
                      if (view === "login") window.location.assign("/history");
                    }
                  }}
                >
                  <Field label="Email address">
                    <input
                      required
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      required
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete={
                        view === "signup" ? "new-password" : "current-password"
                      }
                    />
                  </Field>
                  <button type="submit">
                    {view === "signup" ? "Create account" : "Sign in"}
                  </button>
                </form>
                {providers.google && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => oauth("google", false)}
                  >
                    Continue with Google
                  </button>
                )}
                {providers.discord && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => oauth("discord", false)}
                  >
                    Continue with Discord
                  </button>
                )}
                <details className="card">
                  <summary>Recover your password</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void authAction({
                        action: "recover",
                        email: new FormData(e.currentTarget).get("email"),
                      });
                    }}
                  >
                    <Field label="Recovery email address">
                      <input
                        required
                        name="email"
                        type="email"
                        autoComplete="email"
                      />
                    </Field>
                    <button type="submit">Send recovery link</button>
                  </form>
                </details>
              </>
            )}
            {query.get("verify") && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    await authAction({
                      action: "verify",
                      token: query.get("verify"),
                    })
                  )
                    window.history.replaceState(null, "", "/login");
                }}
              >
                Verify my email
              </button>
            )}
            {query.get("recover") && (
              <form
                className="card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await authAction({
                      action: "reset",
                      token: query.get("recover"),
                      password: new FormData(e.currentTarget).get("password"),
                    })
                  )
                    window.history.replaceState(null, "", "/login");
                }}
              >
                <Field label="New password">
                  <input
                    required
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </Field>
                <button type="submit">Set new password</button>
              </form>
            )}
          </>
        )}
        {view === "seasons" && (
          <>
            <h1>Choose a season</h1>
            <p>
              Work toward 101 reporting days at your pace. Gaps affect streaks,
              rather than your total progress. You can keep one unfinished
              season active.
            </p>
            {seasons.map((s) => (
              <article className="card" key={s.id}>
                <h2>
                  <a href={`/seasons/${s.id}`}>{s.title}</a>
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
              <p>
                Enrollment stays available, including for past seasons.
                Recommended goals are optional.
              </p>
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
                    if (owned) window.location.assign(`/challenge/${owned.id}`);
                    else if (
                      await run({ command: "Enroll", seasonId: season.id })
                    ) {
                      const current =
                        await pages<Enrollment>("/api/v1/history");
                      const found = current.find(
                        (e) => e.seasonId === season.id
                      );
                      if (found)
                        window.location.assign(`/challenge/${found.id}`);
                    }
                  }}
                >
                  Join or continue this season
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
        {view === "account" && (
          <>
            <h1>Account and privacy</h1>
            {account ? (
              <>
                <p>
                  {account.email ?? "Provider account"}
                  {account.emailVerified ? " · Email verified" : ""}
                </p>
                <p>
                  Your reports, goals and milestones are private, including from
                  administrators. Administrators see timestamps, counts, streaks
                  and selected perks. History persists until account erasure;
                  operational logs and backups default to 30-day retention.
                </p>
                <p>
                  <a className="button secondary" href="/api/v1/export">
                    Export my history
                  </a>
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => authAction({ action: "logout" })}
                >
                  Sign out
                </button>
                <details className="card">
                  <summary>Confirm a recent sign-in</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void authAction({
                        action: "reauthenticate",
                        password: new FormData(e.currentTarget).get("password"),
                      });
                    }}
                  >
                    <Field label="Current password">
                      <input
                        required
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        minLength={12}
                        maxLength={128}
                      />
                    </Field>
                    <button type="submit">Confirm password</button>
                  </form>
                  <p>
                    For a provider-only account, sign in again with the provider
                    before changing sign-in methods.
                  </p>
                </details>
                {!account.email && (
                  <form
                    className="card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void authAction({
                        action: "add_email",
                        email: data.get("email"),
                        password: data.get("password"),
                      });
                    }}
                  >
                    <h2>Add email sign-in</h2>
                    <Field label="New email address">
                      <input
                        required
                        name="email"
                        type="email"
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Create password">
                      <input
                        required
                        name="password"
                        type="password"
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </Field>
                    <button type="submit">Add and verify email</button>
                  </form>
                )}
                {providers.google && !account.providers.includes("google") && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => oauth("google", true)}
                  >
                    Link Google
                  </button>
                )}
                {providers.discord &&
                  !account.providers.includes("discord") && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => oauth("discord", true)}
                    >
                      Link Discord
                    </button>
                  )}
                {[
                  ...(account.email ? ["email" as const] : []),
                  ...account.providers,
                ].map((provider) => (
                  <button
                    type="button"
                    key={provider}
                    className="secondary"
                    onClick={() => authAction({ action: "unlink", provider })}
                  >
                    Unlink {provider}
                  </button>
                ))}
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void authAction({
                      action: "request_erasure",
                      confirmed: true,
                    });
                  }}
                >
                  <h2>Request full account erasure</h2>
                  <p>
                    This removes private history and sign-in methods after the
                    request is processed. Cancellation and restart retain your
                    history.
                  </p>
                  <label className="check">
                    <input type="checkbox" required />I confirm removal of this
                    account and all its private history.
                  </label>
                  <button className="danger" type="submit">
                    Request account erasure
                  </button>
                </form>
              </>
            ) : (
              loaded && <a href="/login">Sign in to view your account</a>
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
                      description: data.get("description") || undefined,
                    });
                  }}
                >
                  <Field label="Season title">
                    <input required name="title" maxLength={200} />
                  </Field>
                  <Field label="Season description">
                    <textarea name="description" maxLength={4000} />
                  </Field>
                  <button type="submit">Create draft season</button>
                </form>
                {seasons.map((s) => (
                  <article className="card" key={s.id}>
                    <h2>{s.title}</h2>
                    <p>
                      {s.state} · {s.featured ? "Featured" : "Not featured"}
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
              Grant keys let owners correct existing reports. They never change
              reporting dates, counts or completion. Private text is excluded
              from this view.
            </p>
            {account?.admin && stats ? (
              <>
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
              onClick={() => setGoals(goals.filter((_, index) => index !== i))}
            >
              Remove recommended goal {i + 1}
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
              Remove recommended milestone {i + 1}
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
