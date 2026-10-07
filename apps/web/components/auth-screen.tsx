"use client";

import { useEffect, useState, useCallback } from "react";
import { Field, PasswordInput, Toast } from "./ui";

/** Dedicated authentication routes; verification/reset proofs never appear in other forms. */
export default function AuthScreen({
  view,
}: {
  view: "login" | "signup" | "verify" | "recover" | "reset";
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState(false);
  const [providers, setProviders] = useState({ google: false, discord: false });
  const dismiss = useCallback(() => setMessage(""), []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (view === "login" && (query.has("verify") || query.has("recover"))) {
      const kind = query.has("verify") ? "verify" : "reset";
      window.location.replace(
        `/${kind}?token=${encodeURIComponent(query.get(kind === "verify" ? "verify" : "recover") ?? "")}`
      );
      return;
    }
    setToken(query.get("token") ?? query.get("recoveryEmail") ?? "");
    setRecoveryEmail(query.has("recoveryEmail"));
    if (query.has("verified"))
      setMessage("Email verified. You can now log in.");
    if (query.has("reset"))
      setMessage("Password updated. Log in with your new password.");
    void fetch("/api/v1/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers ?? { google: false, discord: false });
      })
      .catch(() => {});
  }, [view]);
  async function submit(data: FormData) {
    setBusy(true);
    setMessage("");
    const payload =
      view === "login" || view === "signup"
        ? {
            action: view,
            email: data.get("email"),
            password: data.get("password"),
            ...(view === "signup" ? { username: data.get("username") } : {}),
          }
        : view === "recover"
          ? { action: "recover", email: data.get("email") }
          : view === "verify"
            ? {
                action: recoveryEmail ? "verify_recovery_email" : "verify",
                token,
              }
            : { action: "reset", token, password: data.get("password") };
    try {
      const r = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok)
        throw new Error("Please check your details or request a new link.");
      setError(false);
      if (view === "login") window.location.assign("/home");
      else if (view === "signup") window.location.assign("/verify");
      else if (view === "verify")
        window.location.replace(
          recoveryEmail ? "/account" : "/login?verified=1"
        );
      else if (view === "reset") window.location.replace("/login?reset=1");
      else
        setMessage(
          "If this account exists, a recovery link will arrive in your email."
        );
    } catch {
      setError(true);
      setMessage("Please check your details or request a new link.");
    } finally {
      setBusy(false);
    }
  }
  async function oauth(provider: "google" | "discord") {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/oauth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, link: false }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      window.location.assign(data.url);
    } catch {
      setError(true);
      setMessage("This sign-in method is unavailable. Please try again.");
      setBusy(false);
    }
  }
  const titles = {
    login: "Welcome back",
    signup: "Start your 101 days",
    verify: "Verify your email",
    recover: "Recover your password",
    reset: "Choose a new password",
  };
  return (
    <main className="auth-page">
      <p className="eyebrow">Small steps. Lasting progress.</p>
      <h1>{titles[view]}</h1>
      <Toast message={message} error={error} dismiss={dismiss} />
      {view === "verify" && !token ? (
        <section className="card">
          <p>
            Check your email and follow the verification link to finish creating
            your account.
          </p>
        </section>
      ) : (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
        >
          <fieldset className="screen" disabled={busy}>
            {view === "signup" && (
              <Field label="Username">
                <input
                  required
                  name="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_-]+"
                  autoComplete="username"
                />
              </Field>
            )}
            {["login", "signup", "recover"].includes(view) && (
              <Field label="Email address">
                <input
                  required
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                />
              </Field>
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
            <button type="submit">
              {busy
                ? "Please wait…"
                : {
                    login: "Log in",
                    signup: "Create account",
                    verify: "Verify my email",
                    recover: "Send recovery link",
                    reset: "Save password",
                  }[view]}
            </button>
          </fieldset>
        </form>
      )}
      {(view === "login" || view === "signup") && (
        <>
          {(["google", "discord"] as const).map(
            (provider) =>
              providers[provider] && (
                <button
                  key={provider}
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void oauth(provider)}
                >
                  Continue with {provider === "google" ? "Google" : "Discord"}
                </button>
              )
          )}
          <p>
            {view === "login" ? (
              <>
                New here? <a href="/signup">Create an account</a>
              </>
            ) : (
              <>
                Already registered? <a href="/login">Log in</a>
              </>
            )}
          </p>
        </>
      )}
      {view === "login" && <a href="/recover">Forgot your password?</a>}
    </main>
  );
}
