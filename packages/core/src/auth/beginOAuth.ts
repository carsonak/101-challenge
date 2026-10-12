import { randomBytes, randomUUID } from "node:crypto";
import type { Repository } from "../model.js";
import { digest } from "../rules.js";
import type { createAuthSession } from "./session.js";
import { ensure } from "./shared.js";

/** Build beginOAuth behavior using the owning service dependencies. */
export function createAuthBeginOAuth(context: {
  /** Shared service dependency. */ opaque: () => string;
  /** Shared service dependency. */ repository: Repository;
  /** Shared service dependency. */ session: ReturnType<
    typeof createAuthSession
  >;
  /** Shared service dependency. */ clock: () => Date;
}) {
  const { opaque, repository, session, clock } = context;
  return {
    /** Begin browser-bound OAuth proof; a linking target needs recent authenticated CSRF proof. */
    async beginOAuth(
      provider: "google" | "discord",
      browserSecret: string,
      token?: string,
      csrf?: string,
      link = false
    ) {
      const state = opaque(),
        nonce = opaque(),
        verifier = randomBytes(32).toString("base64url");

      await repository.transaction(async (tx) => {
        if (link) ensure(csrf, "FORBIDDEN");

        const userId = link
          ? (await session(tx, token, csrf, true)).user.id
          : null;

        await tx.insert("oauth_states", {
          id: randomUUID(),
          provider,
          userId,
          stateHash: digest(state),
          browserHash: digest(browserSecret),
          nonce,
          verifier,
          expiresAt: new Date(clock().getTime() + 10 * 60000).toISOString(),
          usedAt: null,
        });
      });

      return { state, nonce, verifier };
    },
  };
}
