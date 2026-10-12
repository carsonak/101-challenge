import { errorMessages } from "@challenge/contracts";
import { readResponse } from "./requests";
/** Command and account mutations preserve drafts, proofs and idempotency across renders. */
export function useTrackerActions(context: {
  /** Controller-owned busy. */ busy: boolean;
  /** Controller-owned setBusy. */ setBusy: (value: boolean) => void;
  /** Controller-owned setMessage. */ setMessage: (value: string) => void;
  /** Controller-owned setRawKey. */ setRawKey: (value: string) => void;
  /** Controller-owned pending. */ pending: {
    current: { body: string; key: string } | null;
  };
  /** Controller-owned csrf. */ csrf: string | undefined;
  /** Controller-owned setError. */ setError: (value: boolean) => void;
  /** Controller-owned refresh. */ refresh: (
    projectionsOnly?: boolean
  ) => Promise<void>;
}) {
  const {
    busy,
    setBusy,
    setMessage,
    setRawKey,
    pending,
    csrf,
    setError,
    refresh,
  } = context;

  /** Execute one idempotent command; text remains in child forms when a request fails. */
  async function run(payload: unknown): Promise<boolean> {
    if (busy) return false;

    setBusy(true);
    setMessage("");
    setRawKey("");
    const body = JSON.stringify(payload);
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };

    try {
      const result = await readResponse(
        await fetch("/api/v1/command", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
            "idempotency-key": pending.current.key,
          },
          body,
        })
      );

      pending.current = null;
      if ((payload as { command?: string }).command === "CreateSeason") {
        window.location.assign(`/admin/seasons/${result.resourceId}`);
        return true;
      }

      setError(false);
      setMessage("Saved.");
      if (result.rawKey) setRawKey(result.rawKey);

      await refresh(
        !(payload as { command: string }).command.includes("Season")
      );

      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : "UNAVAILABLE";
      setError(true);
      setMessage(
        errorMessages[code] ??
          "The request could not be completed. Your text is retained; try again."
      );

      if (["VERSION_CONFLICT", "ALREADY_REPORTED"].includes(code))
        await refresh(true).catch(() => {});

      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Cookie-backed account mutations validate CSRF at the server and keep errors safe. */
  async function authAction(payload: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const result = await readResponse(
        await fetch("/api/v1/auth", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
          },
          body: JSON.stringify(payload),
        })
      );

      if ((payload as { action?: string }).action === "reauthenticate")
        return true;

      if (result.requestId) {
        window.location.assign("/login");
        return true;
      }

      setError(false);
      setMessage(
        ["add_email", "recovery_email"].includes(
          (payload as { action: string }).action
        )
          ? "Check your email for the verification link."
          : "Saved."
      );

      await refresh();
      return true;
    } catch (e) {
      setError(true);
      setMessage(
        errorMessages[e instanceof Error ? e.message : ""] ??
          "The request could not be completed. Please try again."
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Start only the configured provider flow with server-bound browser state. */
  async function oauth(provider: "google" | "discord", link: boolean) {
    try {
      const data = await readResponse(
        await fetch("/api/v1/oauth", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrf ?? "",
          },
          body: JSON.stringify({ provider, link }),
        })
      );

      window.location.assign(data.url);
    } catch {
      setError(true);
      setMessage(
        "This sign-in method is unavailable or requires a recent sign-in."
      );
    }
  }

  return {
    /** Submit one idempotent domain command. */ run,
    /** Execute a cookie-backed account action. */ authAction,
    /** Begin server-bound provider proof. */ oauth,
  };
}
