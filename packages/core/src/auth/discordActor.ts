import type { Repository } from "../model.js";

/** Build discordActor behavior using the owning service dependencies. */
export function createAuthDiscordActor(context: {
  /** Shared service dependency. */ repository: Repository;
}) {
  const { repository } = context;
  return {
    /** Map signed guild actors solely through a linked Discord subject. */
    async discordActor(subject: string) {
      return repository.transaction(
        async (tx) =>
          (await tx.list("identities", { provider: "discord", subject }))[0]
            ?.userId
      );
    },
  };
}
