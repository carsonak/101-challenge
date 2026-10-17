"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field, Help, PasswordInput } from "../ui";

import type { ScreenContext } from "./context";
/** SignIns section preserves its existing controls and state. */
export function SignIns(context: ScreenContext) {
  const { account, providers, oauth, setPending } = context;
  return (
    <>
      <section className={uiStyles.card}>
        <h2>Sign-in methods</h2>
        {(["google", "discord"] as const).map((provider) => (
          <div key={provider}>
            <strong>{provider === "google" ? "Google" : "Discord"}</strong>
            {account.providers.includes(provider) ? (
              <button
                type="button"
                className={`${uiStyles.button} ${uiStyles.secondary}`}
                onClick={() => setPending({ action: "unlink", provider })}
              >
                Unlink
              </button>
            ) : (
              <button
                type="button"
                className={`${uiStyles.button} ${uiStyles.secondary}`}
                disabled={!providers[provider]}
                onClick={() => void oauth(provider, true)}
              >
                Link {provider}
              </button>
            )}
            {!providers[provider] && <small>Not configured yet</small>}
          </div>
        ))}
        {account.email ? (
          <p>
            Email sign-in: {account.email}{" "}
            {!account.emailVerified && (
              <span>
                Verification needed.{" "}
                <a href="/verify">Resend verification email</a>
              </span>
            )}{" "}
            <button
              type="button"
              className={`${uiStyles.button} ${uiStyles.secondary}`}
              onClick={() =>
                setPending({ action: "unlink", provider: "email" })
              }
            >
              Unlink email
            </button>
          </p>
        ) : (
          <details>
            <summary>Add password sign-in</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                setPending({
                  action: "add_email",
                  email: d.get("email"),
                  password: d.get("password"),
                });
              }}
            >
              <Field label="Email">
                <input required type="email" name="email" />
              </Field>
              <Field label="New password">
                <PasswordInput
                  required
                  name="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
              <button type="submit" className={uiStyles.button}>
                Add email sign-in
              </button>
            </form>
          </details>
        )}
        {account.emailVerified && (
          <details>
            <summary>Change password</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setPending({
                  action: "change_password",
                  password: new FormData(event.currentTarget).get("password"),
                });
              }}
            >
              <Field label="New password">
                <PasswordInput
                  required
                  name="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
              <p>
                Confirm your current password next. All devices will be signed
                out after saving.
              </p>
              <button type="submit" className={uiStyles.button}>
                Change password
              </button>
            </form>
          </details>
        )}
        <p>
          To replace your sign-in email, first link and test Google or Discord.
          Unlink email, sign in with that linked provider, then add and verify
          the new email. Update your recovery email separately.{" "}
          <a href="/help">Account help</a>
        </p>
        <Help>
          Linking proves ownership of both accounts. At least one usable sign-in
          method must remain.
        </Help>
      </section>{" "}
    </>
  );
}
