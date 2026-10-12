"use client";
import uiStyles from "./../styles/ui.module.css";

import type { accountSchema } from "@challenge/contracts";
import { useEffect, useRef, useState } from "react";
import { Confirmation } from "./account-screen/Confirmation";
import { Deletion } from "./account-screen/Deletion";
import { Devices } from "./account-screen/Devices";
import { Privacy } from "./account-screen/Privacy";
import { Profile } from "./account-screen/Profile";
import { Recovery } from "./account-screen/Recovery";
import { SignIns } from "./account-screen/SignIns";

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
      <section className={`${uiStyles.card} ${uiStyles["danger-zone"]}`}>
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
          className={uiStyles.button}
        >
          Restore my account
        </button>
      </section>
    );
  }

  const context = {
    account,
    providers,
    act,
    oauth,
    sessions,
    confirmation,
    setConfirmation,
    dialog,
    pending,
    setPending,
    avatarError,
    setAvatarError,
    now,
  };

  return (
    <>
      <h1>Account settings</h1>
      {account.provisional && (
        <p className={uiStyles.notice}>
          Confirm your username to finish setting up your profile.
        </p>
      )}
      <Profile {...context} />
      <SignIns {...context} />
      <Recovery {...context} />
      <Devices {...context} />
      <Privacy {...context} />
      <Deletion {...context} />
      <Confirmation {...context} />
    </>
  );
}
