import { row, link } from "./discord/messages";
import { errorMessage } from "@challenge/contracts";
import { logBackend } from "@challenge/core";
import { createDiscordAction } from "./discord/action";
import { createDiscordDashboard } from "./discord/dashboard";
import { createDiscordImmediate } from "./discord/immediate";
import { createDiscordReply } from "./discord/reply";
import { createDiscordReportModal } from "./discord/reportModal";
import { readInteraction } from "./discord/request";
import { createDiscordResponse } from "./discord/response";
import { createDiscordSend } from "./discord/send";
import type { DiscordDependencies } from "./discord/types";
import { createDiscordWork } from "./discord/work";
export { discordLimits, guildCommands } from "./discord/manifest";
export { recoveryChunks } from "./discord/messages";
export type { DiscordDependencies } from "./discord/types";
export { validateDiscordPayload } from "./discord/validation";

/** Verify raw signatures, acknowledge on time, and dispatch only owner-authorized commands. */
export function createDiscordAdapter(deps: DiscordDependencies) {
  const now = deps.now ?? Date.now;
  const localWebsite = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(deps.origin).hostname
  );

  const reply = createDiscordReply({ localWebsite });
  const action = createDiscordAction({ deps });
  const dashboard = createDiscordDashboard({ deps, reply, action });
  const reportModal = createDiscordReportModal({ deps, reply, action });
  const response = createDiscordResponse({});
  return {
    /** Signed guild HTTP endpoint; transient followups use the injected framework lifetime hook. */
    async handle(request: Request): Promise<Response> {
      const parsed = await readInteraction(request, deps, now);
      if (parsed instanceof Response) return parsed;

      const input = parsed;
      const subject = input.member.user.id;
      const send = createDiscordSend({ deps, input });
      const immediate = createDiscordImmediate({
        deps,
        input,
        subject,
        reply,
        reportModal,
      });

      const work = createDiscordWork({
        deps,
        input,
        subject,
        reply,
        send,
        dashboard,
      });

      // Discord's signed continuation token is opaque; the raw-body bound limits its size.

      const immediatePath =
        input.type === 4 ||
        (input.type === 2 && input.data?.name === "report") ||
        (input.type === 3 && !input.data?.custom_id?.startsWith("confirm:"));

      // Components which mutate are deferred; form-opening and pause prompts must be immediate.
      if (immediatePath && !input.data?.custom_id?.startsWith("confirm:")) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const fallback =
          input.type === 4
            ? { type: 8, data: { choices: [] } }
            : reply(
                "The service may be waking up. Please try again in a few seconds, or use the website.",
                [row(link("Open website", `${deps.origin}/home`))]
              );

        try {
          const prepared = await Promise.race([
            immediate(),
            new Promise<typeof fallback>((resolve) => {
              timer = setTimeout(() => resolve(fallback), 2000).unref();
            }),
          ]);

          if (prepared.type !== -1) return response(prepared);
        } catch (error) {
          logBackend(
            "web",
            "discord_form_failed",
            { requestId: deps.requestId },
            error
          );

          return response(
            input.type === 4
              ? { type: 8, data: { choices: [] } }
              : reply(errorMessage((error as { code?: string }).code))
          );
        } finally {
          clearTimeout(timer);
        }
      }

      deps.schedule(async () => {
        try {
          await work();
        } catch (error) {
          logBackend(
            "web",
            "discord_delivery_failed",
            { requestId: deps.requestId },
            error
          );
        }
      });

      return response({ type: 5, data: { flags: 64 } });
    },
  };
}
