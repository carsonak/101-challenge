/** Public description of actual storage and administrator visibility. */
export default function Privacy() {
  return (
    <main>
      <h1>Privacy</h1>
      <section className="card">
        <h2>Your challenge data</h2>
        <p>
          Your logs, goals and milestones are private. Administrators can see
          timestamps, reporting counts, streaks and selected perks, but not
          their private text. Your username and profile picture identify your
          account; they do not make your history public.
        </p>
        <h2>Sign-in and retention</h2>
        <p>
          We store sign-in methods, hashed session proofs, coarse device labels,
          recovery email and your challenge history. Operational logs and
          backups default to 30-day retention. Participant history remains until
          you erase it.
        </p>
        <h2>Your choices</h2>
        <p>
          You can export your history, unlink sign-in methods, revoke sessions,
          remove your profile picture, or request account deletion. Deletion has
          a seven-day recovery period; after that deadline the privileged
          deletion process removes private data. Backup restores replay the
          deletion ledger before serving traffic.
        </p>
        <h2>Artwork</h2>
        <p>
          Artwork is a separate release. Private text is not published by
          default; optional overlays require explicit choices. Previously
          downloaded copies cannot be recalled.
        </p>
      </section>
    </main>
  );
}
