"use client";

import type { ScreenContext } from "./context";
/** Privacy section preserves its existing controls and state. */
export function Privacy(_context: ScreenContext) {
  return (
    <>
      <section>
        <h2>Privacy</h2>
        <a href="/privacy">Read the privacy policy</a> ·{" "}
        <a href="/api/v1/export">Export my history</a>
      </section>{" "}
    </>
  );
}
