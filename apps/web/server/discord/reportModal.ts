import { DomainError } from "@challenge/core";
import { discordLimits } from "./manifest";
import { field, link, type message, row } from "./messages";
import type { DiscordDependencies, Summary } from "./types";

import type { createDiscordAction } from "./action";
/** Build reportModal behavior for a private Discord interaction. */
export function createDiscordReportModal(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
  /** Transient reply dependency. */ reply: typeof message;
  /** Transient action dependency. */ action: ReturnType<
    typeof createDiscordAction
  >;
}) {
  const { deps, reply, action } = context;
  /** Build a complete report modal or route oversized forms to the website. */
  async function reportModal(userId: string, s: Summary) {
    if (
      !s.attemptId ||
      !(
        s.attemptState === "active" ||
        (s.attemptState === "completed" && s.report)
      )
    )
      throw new DomainError("ATTEMPT_CLOSED");

    const measured = s.goals.filter((g) => g.kind !== "qualitative");
    const index = s.report?.reportingIndex ?? s.reportingDays + 1;
    const manual = s.report
      ? []
      : s.milestones.filter(
          (m) =>
            m.achievementKind === "manual" && m.targetReportingDay === index
        );

    if (
      1 + measured.length + Number(manual.length > 0) >
        discordLimits.modalFields ||
      manual.length > discordLimits.checkboxOptions
    )
      return reply(
        "## Finish your report on the website\nThis plan needs more fields than Discord can show. The website includes every goal value and milestone.",
        [row(link("Write your report", `${deps.origin}/challenge/${s.id}`))]
      );

    const components: unknown[] = [
      field("body", "Private daily report", s.report?.body ?? "", true),
    ];

    for (const g of measured)
      components.push(
        field(
          `goal:${g.revisionId}`,
          `${g.title}${g.unit ? ` (${g.unit})` : ""}`,
          s.report?.goalValues.find((v) => v.goalRevisionId === g.revisionId)
            ?.value ?? "",
          false,
          false
        )
      );

    if (manual.length)
      components.push({
        type: 18,
        label: "Milestones achieved today",
        component: {
          type: 22,
          custom_id: "milestones",
          min_values: 0,
          required: false,
          options: manual.map((m) => ({
            label: m.title.slice(0, 100),
            value: m.id,
          })),
        },
      });

    return {
      type: 9,
      data: {
        custom_id: await action(userId, s, "report"),
        title: s.report ? "Edit today's report" : "Report today",
        components,
      },
    };
  }

  return reportModal;
}
