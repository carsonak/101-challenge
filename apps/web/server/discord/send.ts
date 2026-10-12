import type { message } from "./messages";
import type { DiscordDependencies } from "./types";
import { validateDiscordPayload } from "./validation";

import type { GuildInteraction } from "./request";

/** Build send behavior for a private Discord interaction. */
export function createDiscordSend(context: {
  /** Transient deps dependency. */ deps: DiscordDependencies;
  /** Transient input dependency. */ input: GuildInteraction;
}) {
  const { deps, input } = context;
  /** Deliver one validated private followup; delivery failure never rolls back a committed command. */
  async function send(payload: ReturnType<typeof message>) {
    validateDiscordPayload(payload);
    await deps.deliver(input.application_id, input.token, payload.data);
  }

  return send;
}
