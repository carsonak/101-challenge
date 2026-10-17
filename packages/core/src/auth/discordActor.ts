import type { Repository } from "../model.js";

/** Build discordActor behavior using the owning service dependencies. */
export function createAuthDiscordActor(context: {
  /** Shared service dependency. */ repository: Repository;
}) {
  const { repository } = context;
  return {
    /** Map signed guild actors solely through a linked Discord subject. */
    async discordActor(subject: string) {
      return repository.transaction(async (tx) => {
        const identity = (
          await tx.list("identities", { provider: "discord", subject })
        )[0];

        if (!identity || (await tx.get("account_suspensions", identity.userId)))
          return undefined;

        if ((await tx.get("profiles", identity.userId))?.provisional)
          return undefined;

        return identity.userId;
      });
    },
  };
}
