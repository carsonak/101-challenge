"use client";
import { useEffect, useState } from "react";
import uiStyles from "../../styles/ui.module.css";
import { Field } from "../ui";
import type { Stats } from "../tracker-types";
import type { TrackerViewContext } from "./context";
import { readResponse } from "./requests";
import { CorrectionForms } from "./correction-forms";

/** Find one recipient before loading bounded metadata; account handles and report timestamps never include private text. */
export function AdminCorrectionsView({
  account,
  seasons,
  loaded,
  rawKey,
  run,
  busy,
}: TrackerViewContext) {
  const [lookupRevision, setLookupRevision] = useState(0);
  const [prefix, setPrefix] = useState("");
  const [cursor, setCursor] = useState("");
  const [people, setPeople] = useState<{
    items: { id: string; username: string }[];
    nextCursor: string | null;
  }>({ items: [], nextCursor: null });

  const [participant, setParticipant] = useState("");
  const [attemptCursor, setAttemptCursor] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [issuedTo, setIssuedTo] = useState("");
  useEffect(() => {
    if (!account?.admin) return;

    const abort = new AbortController();
    setPeople({ items: [], nextCursor: null });
    setParticipant("");
    setError("");
    void fetch(
      `/api/v1/admin/participants?_refresh=${lookupRevision}&prefix=${encodeURIComponent(prefix)}${cursor ? `&cursor=${cursor}` : ""}`,
      { cache: "no-store", signal: abort.signal }
    )
      .then(readResponse)
      .then((data) => {
        if (!abort.signal.aborted) setPeople(data);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError("Participant lookup failed. Search again to retry.");
      });

    return () => abort.abort();
  }, [account?.admin, prefix, cursor, lookupRevision]);

  useEffect(() => {
    setStats(null);
    if (!participant) return;

    const abort = new AbortController();
    setError("");
    void fetch(
      `/api/v1/admin/stats?_refresh=${revision}&participantId=${participant}${attemptCursor ? `&cursor=${attemptCursor}` : ""}`,
      { cache: "no-store", signal: abort.signal }
    )
      .then(readResponse)
      .then((data) => {
        if (!abort.signal.aborted) setStats(data);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Participant details failed. Choose the participant again or retry."
          );
      });

    return () => abort.abort();
  }, [participant, attemptCursor, revision]);

  const person = people.items.find((p) => p.id === participant);
  return (
    <>
      <h1>Correction grants</h1>
      <p>
        Choose a participant, then an attempt and report. Keys let owners
        correct their own history; completion stays fixed. Report text remains
        private.
      </p>
      {loaded && !account?.admin && (
        <p>Administrator permission is required.</p>
      )}
      {account?.admin && (
        <>
          <form
            className={uiStyles.card}
            onSubmit={(event) => {
              event.preventDefault();
              setCursor("");
              setPrefix(
                String(new FormData(event.currentTarget).get("prefix") ?? "")
                  .trim()
                  .toLowerCase()
              );

              setLookupRevision((value) => value + 1);
            }}
          >
            <Field label="Find participant by username prefix">
              <input name="prefix" maxLength={40} />
            </Field>
            <button type="submit" className={uiStyles.button}>
              Search participants
            </button>
          </form>
          {error && (
            <p role="alert">
              {error}{" "}
              <button
                type="button"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry details
              </button>
            </p>
          )}
          <Field label="Participant">
            <select
              value={participant}
              disabled={busy}
              onChange={(event) => {
                setParticipant(event.target.value);
                setAttemptCursor("");
                setIssuedTo("");
              }}
            >
              <option value="">Choose a participant</option>
              {people.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.username}
                </option>
              ))}
            </select>
          </Field>
          {!people.items.length && (
            <p>
              No participants on this page. Search by username or return to the
              first page.
            </p>
          )}
          {people.nextCursor && (
            <button
              disabled={busy}
              type="button"
              onClick={() => setCursor(people.nextCursor ?? "")}
            >
              Next participants
            </button>
          )}
          {cursor && (
            <button disabled={busy} type="button" onClick={() => setCursor("")}>
              First participants
            </button>
          )}
          {person && stats && stats.users[0]?.id === person.id && (
            <>
              <h2>Participant: {person.username}</h2>
              <CorrectionForms
                key={`${participant}-${attemptCursor}`}
                person={person}
                stats={stats}
                seasons={seasons}
                busy={busy}
                run={async (payload) => {
                  const ok = await run(payload);
                  if (ok) {
                    setIssuedTo(person.id);
                    setRevision((value) => value + 1);
                  }

                  return ok;
                }}
              />
              {rawKey && issuedTo === person.id && (
                <div className={uiStyles.notice}>
                  <p>
                    Key for {person.username}. Copy it now and share privately
                    with this participant. It is shown once.
                  </p>
                  <output className={uiStyles.key}>{rawKey}</output>
                </div>
              )}
              <h2>Attempt metadata for {person.username}</h2>
              {stats.attempts.map((a) => (
                <p key={a.id}>
                  {a.startedAt} · {a.status} · {a.reportingDays} reports ·
                  Streak {a.currentStreak}, longest {a.longestStreak}
                </p>
              ))}
              {stats.grants.map((g) => (
                <article key={g.id} className={uiStyles.card}>
                  <p>
                    {person.username} · {g.kind} · Expires {g.expiresAt} ·{" "}
                    {g.usedAt ? "Used" : g.revokedAt ? "Revoked" : "Available"}
                  </p>
                  <button
                    type="button"
                    disabled={busy || Boolean(g.usedAt || g.revokedAt)}
                    onClick={async () => {
                      if (
                        await run({
                          command: "RevokeCorrectionGrant",
                          grantId: g.id,
                        })
                      )
                        setRevision((value) => value + 1);
                    }}
                  >
                    Revoke grant {g.id}
                  </button>
                </article>
              ))}
              {stats.nextCursor && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAttemptCursor(stats.nextCursor ?? "")}
                >
                  Next attempts
                </button>
              )}
              {attemptCursor && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAttemptCursor("")}
                >
                  First attempts
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
