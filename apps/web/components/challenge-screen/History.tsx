"use client";
import screensStyles from "./../../styles/screens.module.css";
import uiStyles from "./../../styles/ui.module.css";

import { ReportForm } from "../report-form";

import type { ScreenContext } from "./context";
/** History section preserves its existing controls and state. */
export function History(context: ScreenContext) {
  const { enrollment, run, current } = context;
  return (
    <>
      {current && (
        <section className={screensStyles["attempt-sidebar"]}>
          <h3>Previous attempts and logs</h3>
          {[...enrollment.attempts]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .map((a) => (
              <details key={a.attemptId} className={uiStyles.card}>
                <summary>
                  {a.startedAt.slice(0, 10)} · {a.attemptState} ·{" "}
                  {a.reportingDays} reports ·{" "}
                  {a.mode === "progress_only" ? "Progress only" : "Qualifying"}
                </summary>
                {a.reports.map((r) => (
                  <article key={r.id} className={uiStyles.report}>
                    <h4>
                      Day {r.reportingIndex} · {r.reportingDate}
                    </h4>
                    <p className={uiStyles["private-text"]}>{r.body}</p>
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
      )}{" "}
    </>
  );
}
