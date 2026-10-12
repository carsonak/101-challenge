"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { ScreenContext } from "./context";
/** Devices section preserves its existing controls and state. */
export function Devices(context: ScreenContext) {
  const { act, sessions, now } = context;
  return (
    <>
      <section className={uiStyles.card}>
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
                className={`${uiStyles.button} ${uiStyles.secondary}`}
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
      </section>{" "}
    </>
  );
}
