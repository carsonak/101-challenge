"use client";
import uiStyles from "./../../styles/ui.module.css";

import type { TrackerViewContext } from "./context";
/** Render notifications using current controller state and explicit actions. */
export function NotificationsView(context: TrackerViewContext) {
  const { notifications, authAction, view } = context;
  return (
    <>
      {view === "notifications" && (
        <>
          <h1>Notifications</h1>
          {notifications.length ? (
            notifications.map((n) => (
              <article className={uiStyles.card} key={n.id}>
                <a href={n.href}>{n.message}</a>
                <p>
                  {new Date(n.createdAt).toLocaleString()}
                  {!n.readAt && " · Unread"}
                </p>
                <button
                  type="button"
                  className={`${uiStyles.button} ${uiStyles.secondary}`}
                  onClick={() =>
                    void authAction({ action: "notification", id: n.id })
                  }
                >
                  Mark read
                </button>
                <button
                  type="button"
                  className={`${uiStyles.button} ${uiStyles.secondary}`}
                  onClick={() =>
                    void authAction({
                      action: "notification",
                      id: n.id,
                      dismiss: true,
                    })
                  }
                >
                  Dismiss
                </button>
              </article>
            ))
          ) : (
            <p>You’re all caught up.</p>
          )}
        </>
      )}{" "}
    </>
  );
}
