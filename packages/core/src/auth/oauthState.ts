import type { OAuthState, Repository } from "../model.js";
import { digest } from "../rules.js";
import { ensure } from "./shared.js";

/** Build oauthState behavior using the owning service dependencies. */
export function createAuthOauthState(context: {
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { repository, clock } = context;
  return {
    /** Read a short-lived callback state for a provider transport; does not consume it yet. */
    async oauthState(
      provider: "google" | "discord",
      state: string,
      browserSecret: string
    ): Promise<OAuthState> {
      return repository.transaction(async (tx) => {
        const saved = (
          await tx.list("oauth_states", { stateHash: digest(state) })
        )[0];

        ensure(
          saved &&
            saved.provider === provider &&
            saved.browserHash === digest(browserSecret) &&
            !saved.usedAt &&
            saved.expiresAt > clock().toISOString()
        );

        return saved;
      });
    },
  };
}
