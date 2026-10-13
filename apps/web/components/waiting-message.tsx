"use client";
import { useEffect, useState } from "react";

/** Delayed, accessible feedback for a cold service; never retries a mutation or clears entered text. */
export function WaitingMessage({ pending = true }: { pending?: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!pending) return;

    const timer = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!slow || !pending) return null;

  return (
    <p role="status">
      This is taking a moment. The service may be waking up. Please keep this
      page open.
    </p>
  );
}
