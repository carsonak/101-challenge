import { DomainError } from "@challenge/core";
import { discordLimits } from "./manifest";
import { button, field, link, type message, row } from "./messages";
import type { DiscordDependencies } from "./types";

import type { createDiscordReportModal } from "./reportModal";
import type { GuildInteraction } from "./request";
/** Build immediate behavior for a private Discord interaction. */
export function createDiscordImmediate(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
  /** Transient input dependency. */ input: GuildInteraction;
  /** Transient subject dependency. */ subject: string;
  /** Transient reply dependency. */ reply: typeof message;
  /** Transient reportModal dependency. */ reportModal: ReturnType<
    typeof createDiscordReportModal
  >;
}) {
  const { deps, input, subject, reply, reportModal } = context;
  /** Immediate paths cannot defer then open a modal; no domain mutations occur here. */
  async function immediate() {
    const userId = await deps.auth.discordActor(subject);
    if (input.type === 4) {
      const term = String(
        input.data?.options?.find((o) => o.focused)?.value ?? ""
      ).toLowerCase();

      const choices =
        input.data?.name === "report"
          ? userId
            ? (await deps.tracker.dailySummary(userId))
                .filter(
                  (s) =>
                    s.attemptState === "active" ||
                    (s.attemptState === "completed" && s.report)
                )
                .map((s) => ({ name: s.title, value: s.id }))
            : []
          : (await deps.tracker.seasons()).map((s) => ({
              name: s.title,
              value: s.id,
            }));

      return {
        type: 8,
        data: {
          choices: choices
            .filter((c) => c.name.toLowerCase().includes(term))
            .slice(0, discordLimits.choices)
            .map((c) => ({
              ...c,
              name: c.name.slice(0, discordLimits.choiceName),
            })),
        },
      };
    }

    if (!userId)
      return reply(
        "## Connect your account\n- **New here?** Sign in with Discord on the website.\n- **Already have an account?** Sign in there, then link Discord in Account settings.\n\nReturn to `/dashboard` when connected.",
        [row(link("Sign in or link Discord", `${deps.origin}/login`))]
      );

    const summaries = await deps.tracker.dailySummary(userId);
    if (input.type === 2 && input.data?.name === "report") {
      const selected = input.data.options?.find(
        (o) => o.name === "season"
      )?.value;

      const eligible = summaries.filter(
        (s) =>
          s.attemptState === "active" ||
          (s.attemptState === "completed" && s.report)
      );

      const s = selected
        ? eligible.find((s) => s.id === selected)
        : eligible.length === 1
          ? eligible[0]
          : undefined;

      if (!s)
        return reply(
          "## Choose your next step\n- Use `/report` and choose a season to write or edit today’s report.\n- Open `/dashboard` to start a plan or view progress."
        );

      return reportModal(userId, s);
    }

    const context = await deps.database.interactionContext(
      input.data?.custom_id ?? "",
      userId
    );

    if (!context) throw new DomainError("NOT_FOUND");

    if (context.kind === "start" || context.kind === "resume") {
      if (!input.data) throw new DomainError("VALIDATION");

      input.data.custom_id = `confirm:${context.id}`;
      return { type: -1 };
    }

    const s = summaries.find((s) => s.id === context.enrollmentId);
    if (!s) throw new DomainError("NOT_FOUND");

    if (context.kind === "report") return reportModal(userId, s);

    if (context.kind === "custom")
      return {
        type: 9,
        data: {
          custom_id: context.id,
          title: "Your first goals",
          components: [
            field("goal1", "First goal"),
            field("goal2", "Second goal (optional)", "", false, false),
            field("goal3", "Third goal (optional)", "", false, false),
          ],
        },
      };

    if (context.kind === "pause")
      return reply(
        "## Pause this practice?\n**Your reporting days remain safe.**\n\n- Your current streak resets.\n- Credits and perks expire immediately.\n- Another unfinished season can start on the next reporting day.\n\nConfirm below to pause, or keep practising.",
        [
          row(
            button("Confirm pause", `confirm:${context.id}`),
            link("Keep practising", `${deps.origin}/challenge/${s.id}`)
          ),
        ]
      );

    throw new DomainError("VALIDATION");
  }

  return immediate;
}
