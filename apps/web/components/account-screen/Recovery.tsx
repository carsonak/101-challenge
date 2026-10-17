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
        <p>
          {account.recoveryEmail
            ? account.hasPassword
              ? "Keep your recovery address up to date. You can use it with your password to log in."
              : "This address can receive recovery links. Set a password below to also use it to log in."
            : "Recommended: verify a recovery email so you can reset a forgotten password. You can also link Google or Discord below as another way to sign in."}
        </p>
        <p>{account.recoveryEmail ?? "No verified recovery address"}</p>
        {account.email && !account.emailVerified && (
          <p>
            Verification needed for {account.email}.{" "}
            <a href="/verify">Resend verification email</a>
          </p>
        )}
        <Field label="Recovery email address">
          <input
            required
            type="email"
            maxLength={254}
            name="email"
            autoComplete="email"
          />
        </Field>
        <button type="submit" className={uiStyles.button}>
          Send verification link
        </button>
      </form>{" "}
    </>
  );
}
