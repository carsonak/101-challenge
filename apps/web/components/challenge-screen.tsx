"use client";
import screensStyles from "./../styles/screens.module.css";

import { useState } from "react";
import { Backfill } from "./challenge-screen/Backfill";
import { Cancellation } from "./challenge-screen/Cancellation";
import { History } from "./challenge-screen/History";
import { Lifecycle } from "./challenge-screen/Lifecycle";
import { Revisions } from "./challenge-screen/Revisions";
import { Today } from "./challenge-screen/Today";
import type { Enrollment, Season } from "./tracker-types";

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
  const context = {
    enrollment,
    season,
    run,
    current,
    today,
    cancelName,
    setCancelName,
    erase,
    setErase,
  };

  return (
    <div className={screensStyles["challenge-layout"]}>
      <Today {...context} />

      <Backfill {...context} />

      <Lifecycle {...context} />

      <Revisions {...context} />
      <History {...context} />
      <Cancellation {...context} />
    </div>
  );
}
