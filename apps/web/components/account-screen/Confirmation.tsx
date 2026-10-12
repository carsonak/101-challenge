"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field, PasswordInput } from "../ui";

import type { ScreenContext } from "./context";
/** Confirmation section preserves its existing controls and state. */
export function Confirmation(context: ScreenContext) {
  const { account, act, oauth, dialog, pending, setPending } = context;

  return (
    <>
      {pending !== null && (
        <dialog
          ref={dialog}
          onCancel={() => setPending(null)}
          className={`${uiStyles.dialog} ${uiStyles.card} reauth-panel`}
          aria-labelledby="confirm-title"
        >
          <h2 id="confirm-title">Confirm it’s you</h2>
          <p>This sensitive change requires a recent sign-in.</p>
          {account.email ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act({
                    action: "reauthenticate",
                    password: new FormData(e.currentTarget).get("password"),
                  })
                ) {
                  const action = pending;
                  setPending(null);
                  await act(action);
                }
              }}
            >
              <Field label="Current password">
                <PasswordInput
                  required
                  name="password"
                  autoComplete="current-password"
                />
              </Field>
              <button type="submit" className={uiStyles.button}>
                Confirm and continue
              </button>
            </form>
          ) : (
            <>
              <p>
                Continue if you just signed in, or sign in again with your
                provider.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const action = pending;
                  setPending(null);
                  await act(action);
                }}
                className={uiStyles.button}
              >
                Continue
              </button>
              {account.providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void oauth(p, false)}
                  className={uiStyles.button}
                >
                  Sign in with {p}
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className={`${uiStyles.button} ${uiStyles.secondary}`}
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
        </dialog>
      )}{" "}
    </>
  );
}
