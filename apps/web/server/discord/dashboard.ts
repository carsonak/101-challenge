import { DomainError } from "@challenge/core";
import { button, escapeText, link, type message, row } from "./messages";
import type { DiscordDependencies } from "./types";

import type { createDiscordAction } from "./action";
/** Build dashboard behavior for a private Discord interaction. */
export function createDiscordDashboard(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
  /** Transient reply dependency. */ reply: typeof message;
  /** Transient action dependency. */ action: ReturnType<
    typeof createDiscordAction
  >;
}) {
  const { deps, reply, action } = context;
  /** Read current state and build contextual private dashboard actions. */
  async function dashboard(userId: string) {
    const summaries = await deps.tracker.dailySummary(userId);
    if (!summaries.length)
      return reply(
        "## Begin your practice\nChoose a season with `/join`, then start a recommended plan or set your own goals.\n\nUse `/seasons` to see what is available.",
        [row(link("Explore seasons", `${deps.origin}/seasons`))]
      );

    const s =
      summaries.find((s) => s.participation === "active") ?? summaries[0];

    if (!s) throw new DomainError("NOT_FOUND");

    const count = Math.min(101, s.reportingDays);
    const grid = `${Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) =>
        y * 10 + x < count ? "■" : "□"
      ).join("")
    ).join("\n")}\n${count === 101 ? "◆" : "◇"} Day 101`;

    const buttons: unknown[] = [];
    if (s.participation === "active" && s.attemptState === "active") {
      buttons.push(
        button(
          s.report ? "Edit today's report" : "Report today",
          await action(userId, s, "report"),
          true
        )
      );

      buttons.push(button("Pause", await action(userId, s, "pause")));
    } else if (s.participation === "active" && !s.attemptId) {
      const season = (await deps.tracker.seasons()).find(
        (season) => season.id === s.seasonId
      );

      if (season?.goals.length)
        buttons.push(
          button(
            "Start recommended plan",
            await action(userId, s, "start"),
            true
          )
        );

      buttons.push(button("Custom goals", await action(userId, s, "custom")));
    } else if (s.participation === "paused")
      buttons.push(button("Resume", await action(userId, s, "resume"), true));
    else if (s.attemptState === "completed" && s.report)
      buttons.push(
        button("Edit today's report", await action(userId, s, "report"), true)
      );

    buttons.push(link("Open on website", `${deps.origin}/challenge/${s.id}`));
    return reply(
      `## ${escapeText(s.title.slice(0, 120))}\n**Today:** ${s.report ? "Your report is saved. You can still edit it today." : "No report saved yet."}\n\n**Reporting days:** ${s.reportingDays} / 101\n**Current streak:** ${s.currentStreak} days\n**Longest streak:** ${s.longestStreak} days\n**State:** ${s.participation === "paused" ? "Paused" : s.attemptState === "completed" ? "Completed" : !s.attemptId ? "Ready to start" : escapeText(s.participation)}\n\n\`\`\`\n${grid}\n\`\`\`\n■ Reported · □ Remaining · ◇ Day 101`,
      [row(...buttons)]
    );
  }

  return dashboard;
}
