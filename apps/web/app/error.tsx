"use client";
/** Recoverable boundary never renders server diagnostics. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>We couldn’t open this page</h1>
      <p>Please try again. Your saved progress is safe.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
