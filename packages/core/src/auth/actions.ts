import type { AuthCommand } from "@challenge/contracts";
import type { Transaction } from "../model.js";
import { createAuthAccountActions } from "./accountActions.js";
import type {
  ActionContext,
  Delivery,
  ActionResult,
} from "./action-context.js";
import { createAuthAnonymous } from "./anonymous.js";
/** Build transaction-local authentication action dispatch. */
export function createAuthActions(context: ActionContext) {
  const anonymous = createAuthAnonymous(context);
  const account = createAuthAccountActions(context);
  return async function actions(
    tx: Transaction,
    c: AuthCommand,
    computedHash: string | undefined,
    mayMail: boolean,
    device: string,
    deliveryState: Delivery,
    token?: string,
    csrf?: string
  ): Promise<ActionResult> {
    const result = await anonymous(
      tx,
      c,
      computedHash,
      mayMail,
      device,
      deliveryState,
      token,
      csrf
    );

    if (result) return result;

    return account(
      tx,
      c,
      computedHash,
      mayMail,
      device,
      deliveryState,
      token,
      csrf
    );
  };
}
