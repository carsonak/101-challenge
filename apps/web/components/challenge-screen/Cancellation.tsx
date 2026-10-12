"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field } from "../ui";

import type { ScreenContext } from "./context";
/** Cancellation section preserves its existing controls and state. */
export function Cancellation(context: ScreenContext) {
  const {
    enrollment,
    season,
    run,
    current,
    cancelName,
    setCancelName,
    erase,
    setErase,
  } = context;

  return (
    <>
      {current && ["active", "paused"].includes(enrollment.participation) && (
        <form
          className={`${uiStyles.card} ${uiStyles["danger-zone"]}`}
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
          <label className={uiStyles.check}>
            <input
              type="checkbox"
              checked={erase}
              onChange={(e) => setErase(e.target.checked)}
            />
            Also erase this attempt’s logs, goals and milestones
          </label>
          <button
            type="submit"
            className={`${uiStyles.button} ${uiStyles.danger}`}
            disabled={cancelName !== season?.slug}
          >
            Cancel season
          </button>
        </form>
      )}{" "}
    </>
  );
}
