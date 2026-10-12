import { decimalValueSchema, errorMessage } from "@challenge/contracts";
import { DomainError, logBackend } from "@challenge/core";
import {
  escapeText,
  fields,
  link,
  type message,
  recoveryChunks,
  row,
} from "./messages";
import type { DiscordDependencies } from "./types";

import type { createDiscordDashboard } from "./dashboard";
import type { GuildInteraction } from "./request";
import type { createDiscordSend } from "./send";
/** Build work behavior for a private Discord interaction. */
export function createDiscordWork(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
  /** Transient input dependency. */ input: GuildInteraction;
  /** Transient subject dependency. */ subject: string;
  /** Transient reply dependency. */ reply: typeof message;
  /** Transient send dependency. */ send: ReturnType<typeof createDiscordSend>;
  /** Transient dashboard dependency. */ dashboard: ReturnType<
    typeof createDiscordDashboard
  >;
}) {
  const { deps, input, subject, reply, send, dashboard } = context;
  const work = async () => {
    let submitted: ReturnType<typeof fields> | undefined;
    try {
      if (input.type === 2 && input.data?.name === "help") {
        await send(
          reply(
            "## Your daily practice\nA truthful report counts even without goal activity. Missing dates affect streaks, never your reporting-day total.\n\n**Today**\n- `/dashboard` — progress, start a plan, pause or resume.\n- `/report` — write or edit today’s private report.\n\n**Find your practice**\n- `/seasons` — browse published seasons.\n- `/join` — choose a season by name.\n\n**On the website**\nManage detailed goals, backfill, restart, cancellation and corrections. Your replies and report text stay private.",
            [row(link("Open website", `${deps.origin}/home`))]
          )
        );

        return;
      }

      if (input.type === 2 && input.data?.name === "seasons") {
        const seasons = await deps.tracker.seasons();
        await send(
          reply(
            seasons.length
              ? `## Find your practice\n${seasons
                  .slice(0, 10)
                  .map(
                    (s) =>
                      `- **${escapeText(s.title.slice(0, 80))}**${s.featured ? " · Featured" : ""}`
                  )
                  .join("\n")}\n\nUse \`/join\` and choose a season by name.`
              : "## Seasons\nNo seasons are published yet. Check back soon.",
            [row(link("Browse all seasons", `${deps.origin}/seasons`))]
          )
        );

        return;
      }

      if (input.type === 5) submitted = fields(input.data?.components);

      const userId = await deps.auth.discordActor(subject);
      if (!userId) {
        if (input.type === 5) throw new DomainError("UNAUTHENTICATED");

        await send(
          reply(
            "## Connect your account\n- **New here?** Sign in with Discord on the website.\n- **Already have an account?** Sign in there, then link Discord in Account settings.\n\nReturn to `/dashboard` when connected.",
            [row(link("Sign in or link Discord", `${deps.origin}/login`))]
          )
        );

        return;
      }

      if (input.type === 2 && input.data?.name === "join") {
        const seasonId = input.data.options?.find(
          (o) => o.name === "season"
        )?.value;

        await deps.tracker.execute(
          userId,
          { command: "Enroll", seasonId },
          `discord:${input.id}`
        );
      } else if (input.type === 3 || input.type === 5) {
        const id = input.data?.custom_id?.replace(/^confirm:/, "") ?? "";
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new DomainError("VALIDATION");

        const c = await deps.database.interactionContext(id, userId);
        if (!c) throw new DomainError("NOT_FOUND");

        let command: unknown;
        if (c.kind === "start" || c.kind === "custom") {
          const summaries = await deps.tracker.dailySummary(userId);
          const s = summaries.find((s) => s.id === c.enrollmentId);
          if (!s) throw new DomainError("NOT_FOUND");

          const season = (await deps.tracker.seasons()).find(
            (season) => season.id === s.seasonId
          );

          if (!season) throw new DomainError("NOT_FOUND");

          const goals =
            c.kind === "start"
              ? season.goals
              : [1, 2, 3]
                  .map((n) => String(submitted?.get(`goal${n}`) ?? "").trim())
                  .filter(Boolean)
                  .map((title) => ({ title, kind: "qualitative" }));

          command = {
            command: "StartAttempt",
            enrollmentId: c.enrollmentId,
            expectedEnrollmentVersion: c.enrollmentVersion,
            goals,
            milestones: c.kind === "start" ? season.milestones : [],
          };
        } else if (c.kind === "pause" || c.kind === "resume")
          command = {
            command:
              c.kind === "pause" ? "PauseEnrollment" : "ResumeEnrollment",
            enrollmentId: c.enrollmentId,
            expectedEnrollmentVersion: c.enrollmentVersion,
          };
        else if (c.kind === "report" && input.type === 5) {
          const values = [...(submitted ?? [])]
            .filter(([key, value]) => key.startsWith("goal:") && value !== "")
            .map(([key, value]) => {
              if (!decimalValueSchema.safeParse(value).success)
                throw new DomainError("VALIDATION");

              return { goalRevisionId: key.slice(5), value };
            });

          const achievements = submitted?.get("milestones") ?? [];
          if (!Array.isArray(achievements)) throw new DomainError("VALIDATION");

          const current = (await deps.tracker.dailySummary(userId)).find(
            (s) => s.id === c.enrollmentId
          );

          if (!current?.attemptId) throw new DomainError("NOT_FOUND");

          const editing = c.resourceId !== current.attemptId;
          command = {
            command: editing ? "EditReport" : "SubmitReport",
            ...(editing
              ? { reportId: c.resourceId, expectedReportVersion: c.version }
              : {
                  attemptId: c.resourceId,
                  expectedAttemptVersion: c.version,
                }),
            body: submitted?.get("body"),
            goalValues: values,
            ...(!editing ? { milestoneAchievements: achievements } : {}),
          };
        } else throw new DomainError("VALIDATION");

        await deps.tracker.execute(userId, command, `discord:${input.id}`);
      } else if (!(input.type === 2 && input.data?.name === "dashboard"))
        throw new DomainError("VALIDATION");

      await send(await dashboard(userId));
    } catch (error) {
      logBackend(
        "web",
        "discord_action_failed",
        { requestId: deps.requestId },
        error
      );

      await send(
        reply(
          `## Let’s try that again\n${errorMessage((error as { code?: string }).code)}`,
          [row(link("Open website", `${deps.origin}/home`))]
        )
      );

      if (submitted) {
        const recovery = [...submitted]
          .map(
            ([key, value]) =>
              `${key.startsWith("goal:") ? "Goal value" : key}: ${Array.isArray(value) ? value.join(", ") : value}`
          )
          .join("\n");

        for (const chunk of recoveryChunks(recovery))
          await send(reply(`**Your private recovery copy**\n${chunk}`));
      }
    }
  };

  return work;
}
