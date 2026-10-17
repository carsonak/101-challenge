import { parseServerConfig } from "@challenge/contracts";
import uiStyles from "../../styles/ui.module.css";

/** Public help and contact explains supported recovery and current pilot boundaries without exposing account data. */
export default function Help() {
  const { CONTACT_EMAIL, REPORTING_TIMEZONE } = parseServerConfig(process.env);
  return (
    <main>
      <h1>Help and contact</h1>
      <section className={uiStyles.card}>
        <h2>How your challenge works</h2>
        <p>
          Join a season, choose at least one goal, then write a truthful private
          report on 101 different days. A day with no practice still counts when
          you report it. Missing a day breaks your streak, but keeps your
          progress.
        </p>
        <p>
          New challenges use {REPORTING_TIMEZONE}. Your challenge shows its
          fixed timezone; travel does not change when its day ends.
        </p>
        <p>
          You can have one unfinished season active at a time. Pause keeps
          history and releases that slot on the next reporting day. Cancel
          releases it immediately. Both expire unspent credits; cancellation
          requires confirmation.
        </p>
        <p>
          Artwork comes in a later release. Credits are recorded, but cannot yet
          be spent. There are no paid, transferable or redeemable rewards.
        </p>
        <h2>Email and sign-in help</h2>
        <p>
          Check spam and allow 15 minutes between verification requests.{" "}
          <a href="/verify">Resend verification email</a>. If you forgot your
          password, <a href="/recover">request a recovery link</a>.
        </p>
        <p>
          Already have an account? Log in using its existing method, then link
          Google or Discord in Account settings. Signing in with an unlinked
          provider creates a separate account. Matching email addresses never
          merge accounts.
        </p>
        <p>
          You can change your password in Account settings. To replace a sign-in
          email, first link and test another sign-in method, then unlink the old
          email and add and verify the new one. Change the recovery email
          separately. If you cannot use any sign-in method, contact support; a
          username alone cannot prove ownership.
        </p>
        <h2>Your history and corrections</h2>
        <p>
          Your report text is private, including from application
          administrators. You can edit today's report. For older mistakes, ask
          an administrator for a correction key, then correct the report
          yourself. Completion remains recorded.
        </p>
        <p>
          Export your history from Account settings. Cancellation with erasure
          cannot be undone. Account deletion has a seven-day recovery period;
          sign in before the deadline to restore it.
        </p>
        <h2>Contact</h2>
        {CONTACT_EMAIL ? (
          <p>
            For support or privacy questions, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Include the
            time, page and request ID when available. Never send passwords,
            verification links, correction keys or private report text.
          </p>
        ) : (
          <p>
            Contact the organizer who invited you for support or privacy
            questions. A monitored support address must be configured before
            public invitations.
          </p>
        )}
      </section>
    </main>
  );
}

/** Public route title contains no participant data. */
export const metadata = { title: "Help and contact" };
