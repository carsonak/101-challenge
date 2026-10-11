"use client";
import { useState } from "react";
import type { GoalInput, MilestoneInput } from "@challenge/core";
import { Field, Help } from "./ui";
import type { Enrollment, Attempt, Season } from "./tracker-types";
import { emptyGoal, GoalFields } from "./goal-fields";
import { Setup } from "./setup-form";
import { ReportForm } from "./report-form";
import { ProgressGrid } from "./progress-grid";
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
export function Challenge({
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
      <h1>{season?.title ?? "Your challenge"}</h1>
      <p>
        Participation: <strong>{enrollment.participation}</strong> · Timezone:{" "}
        {enrollment.timezone ?? "Choose at setup"}
      </p>
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
      {current && (
        <ProgressGrid
          count={current.reportingDays}
          todayReported={Boolean(today)}
          milestoneIndexes={current.milestoneRevisions
            .filter((r) =>
              current.milestones.some(
                (m) => !m.archived && m.currentRevisionId === r.id
              )
            )
            .map((r) => r.input.targetReportingDay)}
        />
      )}
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
    </div>
  );
}
