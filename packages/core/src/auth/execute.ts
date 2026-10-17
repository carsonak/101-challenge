import type { Throttle } from "../throttle.js";
import type { ActionContext } from "./action-context.js";
import { authCommandSchema, type AuthCommand } from "@challenge/contracts";
import { createAuthActions } from "../auth/actions.js";
import type { Repository } from "../model.js";
import {
  type AuthMail,
  type AuthOptions,
  ensure,
  hashPassword,
} from "./shared.js";

/** Build execute behavior using the owning service dependencies. */
export function createAuthExecute(
  context: ActionContext & {
    repository: Repository;
    options: AuthOptions;
    cooldown: Throttle;
  }
) {
  const {
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
  } = context;

  return {
    /** Execute validated email/account commands; private mail delivery occurs after commit. */
    async execute(
      input: unknown,
      token?: string,
      csrf?: string,
      device = "Unknown browser"
    ) {
      const parsed = authCommandSchema.safeParse(input);
      ensure(parsed.success, "VALIDATION");
      const c: AuthCommand = parsed.data;
      const computedHash =
        c.action === "signup" ||
        c.action === "reset" ||
        c.action === "add_email" ||
        c.action === "change_password"
          ? await hashPassword(c.password)
          : undefined;

      const deliveryState: { mail?: AuthMail } = {};
      const actions = createAuthActions({
        clock,
        opaque,
        session,
        issueSession,
        newUser,
        mailToken,
        revokeSessions,
        dummyState,
      });

      const mayMail =
        "email" in c &&
        [
          "signup",
          "recover",
          "resend_verification",
          "add_email",
          "recovery_email",
        ].includes(c.action)
          ? await cooldown.allow(
              c.action === "recover" ? "recovery-mail" : "verification-mail",
              c.email.trim().toLowerCase(),
              15 * 60000
            )
          : true;

      const result = await repository.transaction(async (tx) =>
        actions(
          tx,
          c,
          computedHash,
          mayMail,
          device,
          deliveryState,
          token,
          csrf
        )
      );

      if (deliveryState.mail) {
        try {
          await options.sendMail(deliveryState.mail);
        } catch {
          /* Enumeration-safe: owner may request another private delivery. */
        }
      }

      return result;
    },
  };
}
