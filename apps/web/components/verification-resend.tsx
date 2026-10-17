"use client";
import { useState } from "react";
import { errorMessage } from "@challenge/contracts";
import { Field } from "./ui";
import uiStyles from "../styles/ui.module.css";

/** Request another credential verification without disclosing whether an account exists; retain the address on failure. */
export function VerificationResend() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <form
      className={uiStyles.card}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;

        const email = new FormData(event.currentTarget).get("email");
        setBusy(true);
        try {
          const response = await fetch("/api/v1/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "resend_verification", email }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.code ?? "UNAVAILABLE");

          setFailed(false);
          setMessage(
            "If this address needs verification, a link will arrive by email. Please allow 15 minutes between requests and check spam."
          );
        } catch (error) {
          setFailed(true);
          setMessage(
            errorMessage(error instanceof Error ? error.message : undefined)
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Need another verification email?</h2>
      <p>
        Check spam first. We send at most one verification email to an address
        every 15 minutes.
      </p>
      <Field label="Email address">
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
        />
      </Field>
      <button className={uiStyles.button} disabled={busy} type="submit">
        {busy ? "Please wait…" : "Resend verification email"}
      </button>
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    </form>
  );
}
