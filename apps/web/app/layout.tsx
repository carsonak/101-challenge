import layoutStyles from "./../styles/layout.module.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import Shell from "../components/shell";

/** Licensed self-hosted heading face; no runtime font-provider requests. */
const display = localFont({
  src: "./fonts/fraunces.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

/** Readable text and progress counters. */
const body = localFont({
  src: "./fonts/source-sans-3.woff2",
  variable: "--font-body",
  weight: "200 900",
  display: "swap",
});

/** Safe product metadata excludes participant content. */
export const metadata: Metadata = {
  title: { default: "101 Challenge", template: "%s · 101 Challenge" },
  description: "Build a steady practice with 101 private reporting days.",
  robots: { index: false, follow: false },
};

/** Theme colors match the user's system preference. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1A20" },
  ],
};

/** CSP nonces are request-specific and cannot be cached in static HTML. */
export const dynamic = "force-dynamic";
/** Fresh accessible shell preserves the pre-paint theme script under CSP. */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
        >{`try{const t=localStorage.getItem("theme");document.documentElement.dataset.theme=["light","dark"].includes(t)?t:"system"}catch{}`}</script>
      </head>
      <body>
        <a href="#content" className={layoutStyles["skip-link"]}>
          Skip to content
        </a>
        <Shell />
        <div id="content">{children}</div>
        <footer className={layoutStyles["site-footer"]}>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </footer>
      </body>
    </html>
  );
}
