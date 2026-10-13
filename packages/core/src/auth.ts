import { randomBytes } from "node:crypto";
import { createAuthAccount } from "./auth/account.js";
import { createAuthAuthenticate } from "./auth/authenticate.js";
import { createAuthBeginOAuth } from "./auth/beginOAuth.js";
import { createAuthCompleteOAuth } from "./auth/completeOAuth.js";
import { createAuthDiscordActor } from "./auth/discordActor.js";
import { createAuthExecute } from "./auth/execute.js";
import { createAuthIssueSession } from "./auth/issueSession.js";
import { createAuthMailToken } from "./auth/mailToken.js";
import { createAuthNewUser } from "./auth/newUser.js";
import { createAuthNotifications } from "./auth/notifications.js";
import { createAuthOauthState } from "./auth/oauthState.js";
import { createAuthRevokeSessions } from "./auth/revokeSessions.js";
import { createAuthSession } from "./auth/session.js";
import { createAuthSessions } from "./auth/sessions.js";
import type { AuthOptions } from "./auth/shared.js";
import type { Repository } from "./model.js";
import { createThrottle } from "./throttle.js";
export {
  type AuthMail,
  type AuthOptions,
  hashPassword,
  type ProviderProof,
  verifyPassword,
} from "./auth/shared.js";

/** Independent account authentication, hashed sessions, recovery and explicit linking. */
export function createAuth(repository: Repository, options: AuthOptions) {
  const clock = options.now ?? (() => new Date());
  const opaque = () => randomBytes(32).toString("hex");
  const dummyState: { current?: Promise<string> } = {};
  const cooldown = options.cooldown ?? createThrottle(() => clock().getTime());
  const session = createAuthSession({ clock });
  const issueSession = createAuthIssueSession({ clock, opaque });
  const mailToken = createAuthMailToken({ opaque, clock });
  const newUser = createAuthNewUser({ clock, opaque });
  const revokeSessions = createAuthRevokeSessions({ clock });
  return {
    ...createAuthAuthenticate({ repository, session }),
    ...createAuthAccount({ repository, session }),
    ...createAuthExecute({
      cooldown,
      repository,
      options,
      clock,
      opaque,
      session,
      issueSession,
      newUser,
      mailToken,
      revokeSessions,
      dummyState,
    }),
    ...createAuthSessions({ repository, session }),
    ...createAuthNotifications({ repository, session, clock }),
    ...createAuthBeginOAuth({ opaque, repository, session, clock }),
    ...createAuthOauthState({ repository, clock }),
    ...createAuthCompleteOAuth({
      repository,
      session,
      newUser,
      clock,
      issueSession,
    }),
    ...createAuthDiscordActor({ repository }),
  };
}
