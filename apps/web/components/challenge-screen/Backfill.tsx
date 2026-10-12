"use client";
import uiStyles from "./../../styles/ui.module.css";

import { ReportForm } from "../report-form";

import type { ScreenContext } from "./context";
/** Backfill section preserves its existing controls and state. */
export function Backfill(context: ScreenContext) {
  const { enrollment, run, current, today } = context;
  return (
    <>
      {current?.backfillDeadline && (
        <section className={uiStyles.card}>
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
      )}{" "}
    </>
  );
}
