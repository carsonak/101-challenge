"use client";
import uiStyles from "./../../styles/ui.module.css";

import { ProgressGrid } from "../progress-grid";
import { ReportForm } from "../report-form";
import { Setup } from "../setup-form";
import { Help } from "../ui";

import type { ScreenContext } from "./context";
/** Today section preserves its existing controls and state. */
export function Today(context: ScreenContext) {
  const { enrollment, season, run, current, today } = context;
  return (
    <>
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
        <div className={uiStyles.metrics}>
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
          Credits are banked for future artwork; spending is not available yet.
        </Help>
      )}
      {current?.attemptState === "completed" && (
        <p className={uiStyles.notice}>
          You showed up for 101 reporting days. Well done.{" "}
          {current.mode === "progress_only"
            ? "Your original seasonal completion stays fixed."
            : "Your seasonal completion is recorded."}{" "}
          Artwork comes in a later release.
        </p>
      )}
      {!current && enrollment.participation === "active" && (
        <Setup enrollment={enrollment} season={season} run={run} />
      )}{" "}
    </>
  );
}
