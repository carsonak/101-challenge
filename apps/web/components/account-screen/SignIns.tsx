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
        <p>
          Recommended: keep another sign-in method linked in case you lose
          access to your password or provider.
        </p>
        <p>
          {account.hasPassword
            ? "Username and password sign-in is enabled."
            : "No password set. Add one to sign in with your username."}
        </p>
        <details>
          <summary>
            {account.hasPassword ? "Change password" : "Set password"}
          </summary>
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
              Confirm your current password or recent provider sign-in next. All
              devices will be signed out after saving.
            </p>
            <button type="submit" className={uiStyles.button}>
              {account.hasPassword ? "Change password" : "Set password"}
            </button>
          </form>
        </details>
        <p>
          Update your email in Recovery email above. The new address becomes a
          sign-in alias only after verification.{" "}
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
