"use client";
import { Field, PasswordInput } from "./ui";

/** Shared bounded auth fields; optional recovery email never blocks signup. */
export function AuthFields({
  view,
}: {
  view: "login" | "signup" | "verify" | "recover" | "reset";
}) {
  return (
    <>
      {view === "signup" && (
        <Field label="Username">
          <input
            required
            name="username"
            minLength={3}
            maxLength={40}
            pattern={"[A-Za-z0-9_\\-]+"}
            autoComplete="username"
          />
        </Field>
      )}
      {view === "login" && (
        <Field label="Username or recovery email">
          <input
            required
            name="identifier"
            maxLength={254}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      )}
      {["signup", "recover"].includes(view) && (
        <Field
          label={
            view === "signup" ? "Recovery email (optional)" : "Email address"
          }
        >
          <input
            required={view === "recover"}
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
          />
        </Field>
      )}
      {view === "signup" && (
        <p>
          Use 3–40 letters, numbers, underscores or hyphens, with no spaces. A
          recovery email is recommended so you can reset a forgotten password;
          verify it before using it to log in.
        </p>
      )}
      {["login", "signup", "reset"].includes(view) && (
        <Field label={view === "reset" ? "New password" : "Password"}>
          <PasswordInput
            required
            name="password"
            minLength={12}
            maxLength={128}
            autoComplete={
              view === "login" ? "current-password" : "new-password"
            }
          />
        </Field>
      )}
    </>
  );
}
