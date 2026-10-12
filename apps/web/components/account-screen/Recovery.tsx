"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field } from "../ui";

import type { ScreenContext } from "./context";
/** Recovery section preserves its existing controls and state. */
export function Recovery(context: ScreenContext) {
  const { account, setPending } = context;
  return (
    <>
      <form
        className={uiStyles.card}
        onSubmit={(e) => {
          e.preventDefault();
          setPending({
            action: "recovery_email",
            email: new FormData(e.currentTarget).get("email"),
          });
        }}
      >
        <h2>Recovery email</h2>
        <p>{account.recoveryEmail ?? "No verified recovery address"}</p>
        <Field label="Recovery email address">
          <input required type="email" name="email" autoComplete="email" />
        </Field>
        <button type="submit" className={uiStyles.button}>
          Send verification link
        </button>
      </form>{" "}
    </>
  );
}
