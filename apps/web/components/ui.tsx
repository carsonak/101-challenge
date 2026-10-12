"use client";
import uiStyles from "./../styles/ui.module.css";

import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type InputHTMLAttributes,
} from "react";

/** Associate a control with a unique visible label. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className={uiStyles.field}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

/** Password-manager-compatible input with an explicit accessible visibility toggle. */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={uiStyles["password-control"]}>
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className={`${uiStyles.button} ${uiStyles.secondary}`}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/** Keyboard and touch accessible contextual help; essential instructions remain outside it. */
export function Help({ children }: { children: React.ReactNode }) {
  return (
    <details className={uiStyles.help}>
      <summary>Help</summary>
      <div>{children}</div>
    </details>
  );
}

/** Overlay feedback never moves content or steals keyboard focus. */
export function Toast({
  message,
  error,
  dismiss,
}: {
  message: string;
  error: boolean;
  dismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(6000);
  useEffect(() => {
    remaining.current = message ? 6000 : 0;
  }, [message]);

  useEffect(() => {
    if (!message || error || paused) return;

    const start = Date.now();
    const timer = setTimeout(dismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [message, error, paused, dismiss]);

  if (!message) return null;

  return (
    <aside
      className={`${uiStyles.toast} ${error ? uiStyles.error : ""} `}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <span role={error ? "alert" : "status"}>{message}</span>
      <button
        type="button"
        className={`${uiStyles.button} ${uiStyles.secondary}`}
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        ×
      </button>
    </aside>
  );
}
