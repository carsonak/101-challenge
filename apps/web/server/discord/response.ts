import type { message } from "./messages";
import { validateDiscordPayload } from "./validation";

/** Build response behavior for a private Discord interaction. */
export function createDiscordResponse(_context: Record<string, never>) {
  /** Return a bounded response after validating it. */
  function response(
    payload:
      | ReturnType<typeof message>
      | { type: number; data?: Record<string, unknown> }
  ) {
    validateDiscordPayload(payload);
    return Response.json(payload);
  }

  return response;
}
