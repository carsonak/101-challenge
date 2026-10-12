import type { randomUUID } from "node:crypto";
import type { createAuthIssueSession } from "./issueSession.js";
import type { createAuthMailToken } from "./mailToken.js";
import type { createAuthNewUser } from "./newUser.js";
import type { createAuthRevokeSessions } from "./revokeSessions.js";
import type { createAuthSession } from "./session.js";
import type { AuthMail } from "./shared.js";
/** Shared dependencies owned by one authentication service. */
export interface ActionContext {
  /** Service clock. */ clock: () => Date;
  /** Cryptographic proof source. */ opaque: () => string;
  /** Reusable enumeration-safe dummy hash. */ dummyState: {
    current?: Promise<string>;
  };
  /** Bound session service helper. */ session: ReturnType<
    typeof createAuthSession
  >;
  /** Bound issueSession service helper. */ issueSession: ReturnType<
    typeof createAuthIssueSession
  >;
  /** Bound newUser service helper. */ newUser: ReturnType<
    typeof createAuthNewUser
  >;
  /** Bound mailToken service helper. */ mailToken: ReturnType<
    typeof createAuthMailToken
  >;
  /** Bound revokeSessions service helper. */ revokeSessions: ReturnType<
    typeof createAuthRevokeSessions
  >;
}

/** Per-request delivery retained only until commit. */
export interface Delivery {
  /** Private mail to deliver after commit. */ mail?: AuthMail;
}

/** Safe action alternatives preserve the existing public result contract. */
export type ActionResult =
  | {
      /** Enumeration-safe acceptance. */ accepted: boolean;
      /** No deletion request was created. */ requestId?: undefined;
    }
  | {
      /** Fresh session bearer, kept within the server adapter. */ token: string;
      /** Fresh session CSRF proof. */ csrf: string;
      /** Absolute session expiry. */ expiresAt: string;
      /** Accepted proof. */ accepted: boolean;
      /** No deletion request was created. */ requestId?: undefined;
    }
  | {
      /** Accepted deletion request. */ accepted: boolean;
      /** UUID reference for scheduled account deletion. */ requestId: ReturnType<
        typeof randomUUID
      >;
    };
