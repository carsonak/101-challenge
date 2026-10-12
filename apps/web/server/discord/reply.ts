import { message } from "./messages";

/** Build reply behavior for a private Discord interaction. */
export function createDiscordReply(context: {
  /** Transient localWebsite dependency. */ localWebsite: boolean;
}) {
  const { localWebsite } = context;
  /** Keep local website links understandable without exposing a public browser endpoint. */
  function reply(content: string, components: unknown[] = []) {
    const note =
      localWebsite && components.length
        ? "\n\n*During local testing, website links work on the computer running the app.*"
        : "";

    return message(content + note, components);
  }

  return reply;
}
