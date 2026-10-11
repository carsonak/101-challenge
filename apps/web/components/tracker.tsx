"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { errorMessages } from "@challenge/contracts";
import { Field, Toast, Help } from "./ui";
import AccountScreen from "./account-screen";
import HomeScreen from "./home-screen";
import Loading from "../app/loading";
import { Setup } from "./setup-form";
import { Challenge } from "./challenge-screen";
import { SeasonTemplate } from "./season-template";
import type {
  History,
  Enrollment,
  Season,
  Stats,
  Account,
} from "./tracker-types";
/** Read bounded API errors without displaying supplied or server-private values. */
async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.code ?? "UNAVAILABLE");
  return data;
}
/** Browser account and participant/admin flows; private values are never persisted in browser storage. */
export default function TrackerScreen({
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
    [stats, setStats] = useState<Stats | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [rawKey, setRawKey] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  /** Load every stable page without sharing private responses through application caches. */
  const pages = useCallback(async <T,>(url: string): Promise<T[]> => {
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
        if (context.account.admin && view === "admin-corrections")
          setStats(
            await readResponse(
              await fetch("/api/v1/admin/stats", { cache: "no-store" })
            )
          );
      } else {
        setHistory([]);
        setStats(null);
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
  useEffect(() => {
    const match = seasons.find((s) => s.id === id);
    if (view === "season" && match)
      window.location.replace(`/seasons/${match.slug}`);
  }, [seasons, id, view]);
  const dismiss = useCallback(() => setMessage(""), []);
  const chosen = history.find((e) => e.id === id);
  const season = seasons.find((s) => s.id === id || s.slug === id);
  if (!loaded) return <Loading />;
  return (
    <main className="tracker">
      <Toast message={message} error={error} dismiss={dismiss} />
      <fieldset className="screen" disabled={busy}>
        <legend className="sr-only">Challenge controls</legend>
        {view === "seasons" && (
          <>
            <h1>Choose a season</h1>
            <Help>
              Work toward 101 reporting days at your pace. Gaps affect streaks,
              rather than your total progress. You can keep one unfinished
              season active.
            </Help>
            {seasons.map((s) => (
              <article className="card" key={s.id}>
                <h2>
                  <a href={`/seasons/${s.slug}`}>{s.title}</a>
                  {s.featured && <span className="badge">Featured</span>}
                </h2>
                <p>{s.description}</p>
              </article>
            ))}
            {loaded && !seasons.length && (
              <p>No published seasons are available yet.</p>
            )}
          </>
        )}
        {view === "season" &&
          (season ? (
            <>
              <h1>{season.title}</h1>
              <p>{season.description}</p>
              <Help>
                Enrollment stays available, including for past seasons.
                Recommended goals are optional.
              </Help>
              {season.goals.length > 0 && (
                <ul>
                  {season.goals.map((g, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: This read-only template list preserves server order.
                    <li key={i}>{g.title}</li>
                  ))}
                </ul>
              )}
              {season.sessionUrl && (
                <a href={season.sessionUrl} rel="noreferrer">
                  Community study sessions
                </a>
              )}
              {account ? (
                <button
                  type="button"
                  onClick={async () => {
                    const owned = history.find((e) => e.seasonId === season.id);
                    if (owned)
                      window.location.assign(
                        ["completed", "cancelled"].includes(owned.participation)
                          ? `/seasons/${season.slug}/setup`
                          : `/challenge/${owned.id}`
                      );
                    else if (
                      await run({ command: "Enroll", seasonId: season.id })
                    ) {
                      const current =
                        await pages<Enrollment>("/api/v1/history");
                      const found = current.find(
                        (e) => e.seasonId === season.id
                      );
                      if (found)
                        window.location.assign(`/seasons/${season.slug}/setup`);
                    }
                  }}
                >
                  {history.some((e) => e.seasonId === season.id)
                    ? ["cancelled", "completed"].includes(
                        history.find((e) => e.seasonId === season.id)
                          ?.participation ?? ""
                      )
                      ? "Retry"
                      : "Continue"
                    : "Join"}
                </button>
              ) : (
                <a className="button" href="/signup">
                  Create an account to join
                </a>
              )}
            </>
          ) : (
            loaded && <p>This season is unavailable.</p>
          ))}
        {view === "history" && (
          <>
            <h1>Your history</h1>
            <p>Cancelled and restarted attempts stay here.</p>
            {!account && loaded ? (
              <a href="/login">Sign in to view your private history</a>
            ) : (
              history.map((e) => (
                <article className="card" key={e.id}>
                  <h2>
                    <a href={`/challenge/${e.id}`}>
                      {seasons.find((s) => s.id === e.seasonId)?.title ??
                        "Challenge"}
                    </a>
                  </h2>
                  <p>
                    {e.participation} · {e.attempts.length} retained attempts
                    {e.hasCompleted ? " · Seasonal completion recorded" : ""}
                  </p>
                </article>
              ))
            )}
          </>
        )}
        {view === "challenge" &&
          (chosen ? (
            <Challenge
              enrollment={chosen}
              season={seasons.find((s) => s.id === chosen.seasonId)}
              run={run}
            />
          ) : (
            loaded && (
              <p>
                This challenge is unavailable.{" "}
                <a href="/history">Return to your history</a>.
              </p>
            )
          ))}
        {view === "account" &&
          (account ? (
            <AccountScreen
              account={account}
              providers={providers}
              act={authAction}
              oauth={oauth}
            />
          ) : (
            loaded && <a href="/login">Log in to view your account</a>
          ))}
        {view === "setup" &&
          season &&
          account &&
          (() => {
            const e = history.find((e) => e.seasonId === season.id);
            const a = e?.attempts.find(
              (a) => a.attemptId === e.currentAttemptId
            );
            return e ? (
              <>
                <h1>{season.title}: your plan</h1>
                <Setup
                  key={e.id}
                  enrollment={e}
                  attempt={a}
                  season={season}
                  run={async (payload) => {
                    const ok = await run(payload);
                    if (ok) window.location.assign(`/challenge/${e.id}`);
                    return ok;
                  }}
                />
              </>
            ) : (
              <a href={`/seasons/${season.slug}`}>Join this season first</a>
            );
          })()}
        {view === "home" && account && (
          <HomeScreen history={history} seasons={seasons} />
        )}
        {view === "notifications" && (
          <>
            <h1>Notifications</h1>
            {notifications.length ? (
              notifications.map((n) => (
                <article className="card" key={n.id}>
                  <a href={n.href}>{n.message}</a>
                  <p>
                    {new Date(n.createdAt).toLocaleString()}
                    {!n.readAt && " · Unread"}
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void authAction({ action: "notification", id: n.id })
                    }
                  >
                    Mark read
                  </button>
                  <button
                    type="button"
                    className="secondary"
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
        )}
        {view === "admin-seasons" && (
          <>
            <h1>Manage seasons</h1>
            {account?.admin ? (
              <>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run({
                      command: "CreateSeason",
                      title: data.get("title"),
                      slug: data.get("slug"),
                      description: data.get("description") || undefined,
                    });
                  }}
                >
                  <Field label="Season URL identifier">
                    <input
                      required
                      name="slug"
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={80}
                    />
                  </Field>
                  <Field label="Season title">
                    <input required name="title" maxLength={200} />
                  </Field>
                  <Field label="Season description">
                    <textarea name="description" maxLength={4000} />
                  </Field>
                  <button type="submit">Create draft season</button>
                </form>
                <div className="columns">
                  <aside className="sidebar" aria-label="Season editor list">
                    {seasons.map((s) => (
                      <a key={s.id} href={`/admin/seasons/${s.id}`}>
                        {s.title} · {s.state}
                        {s.featured ? " · Featured" : ""}
                      </a>
                    ))}
                  </aside>
                  <div>
                    {seasons
                      .filter((s) => s.id === id)
                      .map((s) => (
                        <article className="card" key={s.id}>
                          <h2>{s.title}</h2>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const d = new FormData(e.currentTarget);
                              void run({
                                command: "SaveSeason",
                                seasonId: s.id,
                                expectedSeasonVersion: s.version,
                                title: d.get("title"),
                                description: d.get("description"),
                                slug: d.get("slug"),
                                ...(!s.publishedAt &&
                                s.state === "published" &&
                                d.get("publishedAt")
                                  ? {
                                      publishedAt: new Date(
                                        String(d.get("publishedAt"))
                                      ).toISOString(),
                                    }
                                  : {}),
                              });
                            }}
                          >
                            <Field label="Season title">
                              <input
                                required
                                name="title"
                                defaultValue={s.title}
                                maxLength={200}
                              />
                            </Field>
                            <Field label="Description">
                              <textarea
                                name="description"
                                defaultValue={s.description ?? ""}
                                maxLength={4000}
                              />
                            </Field>
                            <Field label="URL identifier">
                              <input
                                required
                                name="slug"
                                defaultValue={s.slug}
                                readOnly={s.state === "published"}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                              />
                            </Field>
                            {!s.publishedAt && s.state === "published" && (
                              <Field label="Verified first publication instant (UTC)">
                                <input
                                  type="datetime-local"
                                  name="publishedAt"
                                />
                              </Field>
                            )}
                            <button type="submit">Save season details</button>
                          </form>
                          <p>
                            {s.state} ·{" "}
                            {s.featured ? "Featured" : "Not featured"}
                          </p>
                          {s.state === "draft" && (
                            <button
                              type="button"
                              onClick={() =>
                                run({
                                  command: "PublishSeason",
                                  seasonId: s.id,
                                  expectedSeasonVersion: s.version,
                                })
                              }
                            >
                              Publish {s.title}
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              run({
                                command: "SetSeasonFeatured",
                                seasonId: s.id,
                                expectedSeasonVersion: s.version,
                                featured: !s.featured,
                              })
                            }
                          >
                            {s.featured
                              ? "Remove from featured"
                              : "Feature this season"}
                          </button>
                          <SeasonTemplate key={s.id} season={s} run={run} />
                        </article>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              loaded && <p>Administrator permission is required.</p>
            )}
          </>
        )}
        {view === "admin-corrections" && (
          <>
            <h1>Correction grants</h1>
            <p>
              Grant keys let owners correct existing reports and eligible dates.
              Existing completion entitlements remain fixed.
            </p>
            {account?.admin && stats ? (
              <>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void run({
                      command: "BackdateEnrollment",
                      userId: d.get("userId"),
                      seasonId: d.get("seasonId"),
                      registeredDate: d.get("date"),
                    });
                  }}
                >
                  <h2>Backdated participation</h2>
                  <Field label="Participant">
                    <select name="userId" required>
                      {stats.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Season">
                    <select required name="seasonId">
                      {seasons
                        .filter((s) => s.publishedAt)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Effective registration date">
                    <input required name="date" type="date" />
                  </Field>
                  <p>
                    The participant has 24 hours to fill missing reports.
                    Unfilled dates do not count.
                  </p>
                  <button type="submit">Create backdated participation</button>
                </form>
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const kind = data.get("kind");
                    void run(
                      kind === "single_report"
                        ? {
                            command: "IssueCorrectionGrant",
                            kind,
                            reportId: data.get("reportId"),
                          }
                        : {
                            command: "IssueCorrectionGrant",
                            kind: "attempt_window",
                            attemptId: data.get("attemptId"),
                            durationMinutes: Number(data.get("minutes")),
                          }
                    );
                  }}
                >
                  <Field label="Grant scope">
                    <select name="kind">
                      <option value="single_report">
                        One report, one use, expires in 24 hours
                      </option>
                      <option value="attempt_window">
                        Attempt window, up to one hour
                      </option>
                    </select>
                  </Field>
                  <Field label="Report">
                    <select name="reportId">
                      {stats.reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          Day {r.reportingIndex} · {r.reportingDate} · {r.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Attempt">
                    <select name="attemptId">
                      {stats.attempts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.startedAt} · {a.reportingDays} reports · {a.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Window minutes">
                    <input
                      name="minutes"
                      type="number"
                      min={1}
                      max={60}
                      defaultValue={60}
                    />
                  </Field>
                  <button type="submit">Issue correction key</button>
                </form>
                {rawKey && (
                  <div className="notice">
                    <p>
                      Copy this key now and give it privately to the owner. It
                      is shown once.
                    </p>
                    <output className="key">{rawKey}</output>
                  </div>
                )}
                {stats.grants.map((g) => (
                  <article key={g.id} className="card">
                    <p>
                      {g.kind} · Expires {g.expiresAt} ·{" "}
                      {g.usedAt
                        ? "Used"
                        : g.revokedAt
                          ? "Revoked"
                          : "Available"}
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      disabled={Boolean(g.usedAt || g.revokedAt)}
                      onClick={() =>
                        run({ command: "RevokeCorrectionGrant", grantId: g.id })
                      }
                    >
                      Revoke grant {g.id}
                    </button>
                  </article>
                ))}
                <h2>Metadata</h2>
                {stats.attempts.map((a) => (
                  <p key={a.id}>
                    {a.id} · {a.status} · {a.reportingDays} reports · Streak{" "}
                    {a.currentStreak}, longest {a.longestStreak} ·{" "}
                    {a.rerollCredits} credits
                  </p>
                ))}
              </>
            ) : (
              loaded && <p>Administrator permission is required.</p>
            )}
          </>
        )}
      </fieldset>
      {!loaded && <p role="status">Loading…</p>}
    </main>
  );
}
