"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Setup } from "../setup-form";

import type { ScreenContext } from "./context";
/** Lifecycle section preserves its existing controls and state. */
export function Lifecycle(context: ScreenContext) {
  const { enrollment, season, run, current } = context;
  return (
    <>
      {current && enrollment.participation === "active" && (
        <section className={uiStyles.card}>
          <h3>Pause season</h3>
          <p>
            Pausing resets your streak and removes credits and active perks
            immediately. Another unfinished season can start on the next
            reporting day.
          </p>
          <button
            type="button"
            className={`${uiStyles.button} ${uiStyles.secondary}`}
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
          className={uiStyles.button}
        >
          Resume enrollment
        </button>
      )}
      {current &&
        (current.attemptState === "active" ||
          current.attemptState === "completed" ||
          current.attemptState === "cancelled") && (
          <details className={uiStyles.card}>
            <summary>Restart with new initial goals</summary>
            <Setup
              key={current.attemptId}
              enrollment={enrollment}
              attempt={current}
              season={season}
              run={run}
            />
          </details>
        )}{" "}
    </>
  );
}
