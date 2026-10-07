"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/** Shared navigation and non-sensitive theme preference for all public/private routes. */
export default function Shell() {
  const [account, setAccount] = useState<{
    admin: boolean;
    username?: string;
    avatar?: string | null;
  } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [theme, setTheme] = useState("system");
  const header = useRef<HTMLElement>(null);
  const csrf = useRef("");
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("theme") || "system");
    } catch {}
    const refresh = () => {
      void fetch("/api/v1/session", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setAccount(data.account ?? null);
          csrf.current = data.csrf ?? "";
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("account-changed", refresh);
    let previous = window.scrollY;
    const scroll = () => {
      const y = window.scrollY;
      const pinned =
        header.current?.contains(document.activeElement) ||
        header.current?.querySelector("details[open]");
      setHidden(!pinned && y > previous && y > 100);
      previous = y;
    };
    const focus = () => setHidden(false);
    document.addEventListener("focusin", focus);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("focusin", focus);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("account-changed", refresh);
    };
  }, []);
  function chooseTheme(value: string) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("theme", value);
    } catch {}
  }
  return (
    <header ref={header} className={`app-header ${hidden ? "nav-hidden" : ""}`}>
      <nav aria-label="Challenge navigation">
        <a className="brand" href={account ? "/home" : "/"}>
          101<span> / Kisumu</span>
        </a>
        <a href={account ? "/home" : "/"}>Home</a>
        <a href="/seasons">Seasons</a>
        {account?.admin && (
          <>
            <a href="/admin/seasons">Manage seasons</a>
            <a href="/admin/corrections">Corrections</a>
          </>
        )}
        <div className="nav-end">
          <label className="sr-only" htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            aria-label="Theme"
            value={theme}
            onChange={(e) => chooseTheme(e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          {account ? (
            <details className="profile-menu">
              <summary aria-label="Open profile menu">
                <span className="avatar">
                  {account.avatar ? (
                    <Image
                      src={account.avatar}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                    />
                  ) : (
                    (account.username ?? "You").slice(0, 2).toUpperCase()
                  )}
                </span>
              </summary>
              <div className="menu">
                <strong>{account.username ?? "Your account"}</strong>
                <a href="/account">Account settings</a>
                <a href="/notifications">Notifications</a>
                <a href="/history">History</a>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await fetch("/api/v1/auth", {
                      method: "POST",
                      headers: {
                        "content-type": "application/json",
                        "x-csrf-token": csrf.current,
                      },
                      body: JSON.stringify({ action: "logout" }),
                    });
                    if (r.ok) window.location.assign("/login");
                  }}
                >
                  Log out
                </button>
              </div>
            </details>
          ) : (
            <>
              <a href="/login">Log in</a>
              <a className="button" href="/signup">
                Sign up
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
