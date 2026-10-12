"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field } from "../ui";

import type { ScreenContext } from "./context";
/** Deletion section preserves its existing controls and state. */
export function Deletion(context: ScreenContext) {
  const { account, confirmation, setConfirmation, setPending } = context;
  return (
    <>
      <form
        className={`${uiStyles.card} ${uiStyles["danger-zone"]}`}
        onSubmit={(e) => {
          e.preventDefault();
          setPending({
            action: "request_erasure",
            confirmed: true,
            username: confirmation,
          });
        }}
      >
        <h2>Delete account</h2>
        <p>
          Deletion removes your account and private history after seven days.
          During that time, sign in to restore your account.
        </p>
        {!account.recoveryEmail && (
          <p>Verify a recovery email above before requesting deletion.</p>
        )}
        <Field label={`Type ${account.username} to confirm deletion`}>
          <input
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <button
          type="submit"
          className={`${uiStyles.button} ${uiStyles.danger}`}
          disabled={!account.recoveryEmail || confirmation !== account.username}
        >
          Schedule account deletion
        </button>
      </form>{" "}
    </>
  );
}
