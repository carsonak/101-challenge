import { errorMessages } from "@challenge/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Account, Enrollment, History, Season } from "../tracker-types";
import { useTrackerActions } from "./actions";
import { readResponse } from "./requests";
/** Own session-scoped projections and targeted refreshes without storing private browser data. */
export function useTrackerController({
  view,
  id,
}: {
  view:
    | "login"
    | "signup"
    | "setup"
    | "home"
    | "notifications"
    | "account"
    | "seasons"
    | "season"
    | "challenge"
    | "history"
    | "admin-seasons"
    | "admin-corrections";
  id?: string;
}) {
  const [notifications, setNotifications] = useState<
    {
      id: string;
      message: string;
      href: string;
      createdAt: string;
      readAt: string | null;
    }[]
  >([]);

  const [account, setAccount] = useState<Account | null>(null),
    [csrf, setCsrf] = useState<string | undefined>(),
    [providers, setProviders] = useState({ google: false, discord: false }),
    [history, setHistory] = useState<History>([]),
    [seasons, setSeasons] = useState<Season[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [rawKey, setRawKey] = useState("");

  const pending = useRef<{ body: string; key: string } | null>(null);
  /** Load every stable page without sharing private responses through application caches. */
  const pages = useCallback(async <T>(url: string): Promise<T[]> => {
    const result: T[] = [];
    let cursor: string | null = null;
    do {
      const data = await readResponse(
        await fetch(
          `${url}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          { cache: "no-store" }
        )
      );

      result.push(...data.items);
      cursor = data.nextCursor;
    } while (cursor);

    return result;
  }, []);

  /** Refresh session-scoped projections after a successful mutation or version conflict. */
  const contextRef = useRef({ account, csrf, providers });
  contextRef.current = { account, csrf, providers };
  const refresh = useCallback(
    async (projectionsOnly = false) => {
      const context = projectionsOnly
        ? contextRef.current
        : await readResponse(
            await fetch("/api/v1/session", { cache: "no-store" })
          );

      if (!projectionsOnly) {
        setAccount(context.account);
        window.dispatchEvent(new Event("account-changed"));
        setCsrf(context.csrf ?? undefined);
        setProviders(context.providers);
      }

      if (!projectionsOnly && !["account", "notifications"].includes(view))
        setSeasons(
          await pages<Season>(
            context.account?.admin && view === "admin-seasons"
              ? "/api/v1/admin/seasons"
              : "/api/v1/seasons"
          )
        );

      if (context.account?.deletion) {
        setLoaded(true);
        if (view !== "account") window.location.replace("/account");

        return;
      }

      if (context.account?.provisional && view !== "account") {
        window.location.replace("/account");
        return;
      }

      if (!context.account && ["home", "notifications"].includes(view)) {
        window.location.replace("/login");
        return;
      }

      if (context.account) {
        if (view === "notifications")
          setNotifications(
            await readResponse(
              await fetch("/api/v1/notifications", { cache: "no-store" })
            )
          );

        if (["home", "challenge", "season", "setup", "history"].includes(view))
          setHistory(await pages<Enrollment>("/api/v1/history"));
      } else {
        setHistory([]);
      }

      setLoaded(true);
    },
    [pages, view]
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setError(true);
      setMessage(
        errorMessages.oauth ??
          "Sign-in could not be completed. Please try again."
      );

      window.history.replaceState(null, "", window.location.pathname);
    }

    void refresh().catch(() => {
      setError(true);
      setMessage("The service is unavailable. Please try again shortly.");
      setLoaded(true);
    });
  }, [refresh]);

  const { run, authAction, oauth } = useTrackerActions({
    busy,
    setBusy,
    setMessage,
    setRawKey,
    pending,
    csrf,
    setError,
    refresh,
  });

  useEffect(() => {
    const match = seasons.find((s) => s.id === id);
    if (view === "season" && match)
      window.location.replace(`/seasons/${match.slug}`);
  }, [seasons, id, view]);

  const dismiss = useCallback(() => setMessage(""), []);
  const chosen = history.find((e) => e.id === id);
  const season = seasons.find((s) => s.id === id || s.slug === id);
  return {
    /** Current notifications controller value. */ notifications,
    /** Current account controller value. */ account,
    /** Current providers controller value. */ providers,
    /** Current history controller value. */ history,
    /** Current seasons controller value. */ seasons,
    /** Current message controller value. */ message,
    /** Current error controller value. */ error,
    /** Current busy controller value. */ busy,
    /** Current loaded controller value. */ loaded,
    /** Current rawKey controller value. */ rawKey,
    /** Current pages controller value. */ pages,
    /** Current refresh controller value. */ refresh,
    /** Current run controller value. */ run,
    /** Current authAction controller value. */ authAction,
    /** Current oauth controller value. */ oauth,
    /** Current dismiss controller value. */ dismiss,
    /** Current chosen controller value. */ chosen,
    /** Current season controller value. */ season,
    /** Current view controller value. */ view,
    /** Current id controller value. */ id,
  };
}
