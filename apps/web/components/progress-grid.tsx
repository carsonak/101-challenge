"use client";
import { useEffect, useRef, useState } from "react";
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
      className="progress-pattern"
      aria-label={`${filled} of 101 reporting days`}
    >
      <div className="progress-grid">
        {Array.from({ length: 100 }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: Fixed cells represent permanent reporting indexes.
            key={i}
            className={`progress-cell ${changed && i === filled - 1 ? "cell-saved" : ""} ${i < filled ? "reported" : i === filled && !todayReported ? "today-cell" : ""}`}
            aria-hidden="true"
          >
            {milestoneIndexes.includes(i + 1) ? "·" : ""}
          </span>
        ))}
      </div>
      <span
        className={`progress-cell capstone ${filled === 101 ? "reported" : ""}`}
        aria-hidden="true"
      >
        101
      </span>
      <span className="sr-only">
        {milestoneIndexes.length
          ? `Milestones on reporting days ${milestoneIndexes.join(", ")}.`
          : ""}
      </span>
    </fieldset>
  );
}
