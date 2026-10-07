"use client";
import { useEffect, useRef, useState } from "react";
import type { accountSchema } from "@challenge/contracts";
import { Field, Help, PasswordInput } from "./ui";

/** Profile, linked sign-ins, session management and explicitly confirmed account deletion. */
export default function AccountScreen({
  account,
  providers,
  act,
  oauth,
}: {
  account: ReturnType<typeof accountSchema.parse>;
  providers: { google: boolean; discord: boolean };
  act: (payload: unknown) => Promise<boolean>;
  oauth: (provider: "google" | "discord", link: boolean) => Promise<void>;
}) {
  const [sessions, setSessions] = useState<
    {
      id: string;
      device: string;
      authenticatedAt: string;
      expiresAt: string;
      revokedAt: string | null;
      current: boolean;
    }[]
  >([]);
  const [confirmation, setConfirmation] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  useEffect(() => {
    if (pending !== null && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [pending]);
  const [avatarError, setAvatarError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (account.deletion) return;
    void fetch("/api/v1/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSessions)
      .catch(() => {});
  }, [account]);
  useEffect(() => {
    if (!account.deletion) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [account.deletion]);
  if (account.deletion) {
    const seconds = Math.max(
      0,
      Math.floor((Date.parse(account.deletion.deleteAfter) - now) / 1000)
    );
    return (
      <section className="card danger-zone">
        <h1>Account deletion scheduled</h1>
        <p>
          Requested {new Date(account.deletion.requestedAt).toLocaleString()}.
        </p>
        <p>
          Deletion deadline:{" "}
          {new Date(account.deletion.deleteAfter).toLocaleString()}.
        </p>
        <p>
          {Math.floor(seconds / 86400)}d {Math.floor(seconds / 3600) % 24}h{" "}
          {Math.floor(seconds / 60) % 60}m {seconds % 60}s
        </p>
        <button
          disabled={!seconds}
          type="button"
          onClick={() =>
            void act({ action: "restore_account" }).then((ok) => {
              if (ok) window.location.assign("/home");
            })
          }
        >
          Restore my account
        </button>
      </section>
    );
  }
  return (
    <>
      <h1>Account settings</h1>
      {account.provisional && (
        <p className="notice">
          Confirm your username to finish setting up your profile.
        </p>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void act({
            action: "save_profile",
            username: new FormData(e.currentTarget).get("username"),
          });
        }}
      >
        <h2>Your profile</h2>
        <Field label="Username">
          <input
            required
            name="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            defaultValue={account.username}
          />
        </Field>
        <button type="submit">Save username</button>
        <Field label="Profile picture">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAvatarError("");
              if (
                file.size > 250000 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setAvatarError("Choose a JPG, PNG or WebP image under 250 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                void act({ action: "set_avatar", avatar: reader.result });
              };
              reader.readAsDataURL(file);
            }}
          />
        </Field>
        {avatarError && <p role="alert">{avatarError}</p>}
        <button
          type="button"
          className="secondary"
          onClick={() => void act({ action: "set_avatar", avatar: null })}
        >
          Remove picture
        </button>
      </form>
      <section className="card">
        <h2>Sign-in methods</h2>
        {(["google", "discord"] as const).map((provider) => (
          <div key={provider}>
            <strong>{provider === "google" ? "Google" : "Discord"}</strong>
            {account.providers.includes(provider) ? (
              <button
                type="button"
                className="secondary"
                onClick={() => setPending({ action: "unlink", provider })}
              >
                Unlink
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
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
            <button
              type="button"
              className="secondary"
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
              <button type="submit">Add email sign-in</button>
            </form>
          </details>
        )}
        <Help>
          Linking proves ownership of both accounts. At least one usable sign-in
          method must remain.
        </Help>
      </section>
      <form
        className="card"
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
        <button type="submit">Send verification link</button>
      </form>
      <section className="card">
        <h2>Recent sign-ins and devices</h2>
        {sessions.map((s) => (
          <article key={s.id}>
            <strong>
              {s.device}
              {s.current ? " · This session" : ""}
            </strong>
            <p>
              Signed in {new Date(s.authenticatedAt).toLocaleString()} ·{" "}
              {s.revokedAt
                ? "Signed out"
                : Date.parse(s.expiresAt) < now
                  ? "Expired"
                  : "Active"}
            </p>
            {!s.revokedAt && Date.parse(s.expiresAt) > now && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void act({ action: "revoke_session", sessionId: s.id }).then(
                    (ok) => {
                      if (ok && s.current) window.location.assign("/login");
                    }
                  )
                }
              >
                Sign out this device
              </button>
            )}
          </article>
        ))}
      </section>
      <section>
        <h2>Privacy</h2>
        <a href="/privacy">Read the privacy policy</a> ·{" "}
        <a href="/api/v1/export">Export my history</a>
      </section>
      <form
        className="card danger-zone"
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
          className="danger"
          disabled={!account.recoveryEmail || confirmation !== account.username}
        >
          Schedule account deletion
        </button>
      </form>
      {pending !== null && (
        <dialog
          ref={dialog}
          onCancel={() => setPending(null)}
          className="card reauth-panel"
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
              <button type="submit">Confirm and continue</button>
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
              >
                Continue
              </button>
              {account.providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void oauth(p, false)}
                >
                  Sign in with {p}
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => setPending(null)}
          >
            Cancel
          </button>
        </dialog>
      )}
    </>
  );
}
