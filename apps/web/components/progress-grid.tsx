"use client";
import progressStyles from "./../styles/progress.module.css";
import uiStyles from "./../styles/ui.module.css";

import { useEffect, useRef, useState } from "react";
// TODO(artwork): Integrate the approved artwork view while retaining accessible reporting counts; see plans/artwork-generator.
/** Reporting-index grid with a separate completion capstone and accessible summary. */
export function ProgressGrid({
  count,
  todayReported = false,
  milestoneIndexes = [],
}: {
  count: number;
  todayReported?: boolean;
  milestoneIndexes?: number[];
}) {
  const previous = useRef(count);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    setChanged(count > previous.current);
    previous.current = count;
    const timer = setTimeout(() => setChanged(false), 250);
    return () => clearTimeout(timer);
  }, [count]);

  const filled = Math.max(0, Math.min(101, count));
  return (
    <fieldset
      className={progressStyles["progress-pattern"]}
      aria-label={`${filled} of 101 reporting days`}
    >
      <div className={progressStyles["progress-grid"]}>
        {Array.from({ length: 100 }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: Fixed cells represent permanent reporting indexes.
            key={i}
            className={
              "" +
              progressStyles["progress-cell"] +
              " " +
              (changed && i === filled - 1
                ? progressStyles["cell-saved"]
                : "") +
              " " +
              (i < filled
                ? progressStyles.reported
                : i === filled && !todayReported
                  ? progressStyles["today-cell"]
                  : "") +
              " "
            }
            aria-hidden="true"
          >
            {milestoneIndexes.includes(i + 1) ? "·" : ""}
          </span>
        ))}
      </div>
      <span
        className={
          "" +
          progressStyles["progress-cell"] +
          " " +
          " " +
          progressStyles.capstone +
          " " +
          (filled === 101 ? progressStyles.reported : "") +
          " "
        }
        aria-hidden="true"
      >
        101
      </span>
      <span className={uiStyles["sr-only"]}>
        {milestoneIndexes.length
          ? `Milestones on reporting days ${milestoneIndexes.join(", ")}.`
          : ""}
      </span>
    </fieldset>
  );
}
