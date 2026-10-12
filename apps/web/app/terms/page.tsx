import uiStyles from "./../../styles/ui.module.css";
/** Plain-language pilot terms require operator review before participant release. */
export default function Terms() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main>
      <h1>Terms of use</h1>
      <section className={uiStyles.card}>
        <h2>Your practice</h2>
        <p>
          Use the tracker to record truthful reports and goals. A report can
          honestly describe a day without activity. Completion records
          participation, not verified performance or a financial reward.
        </p>
        <h2>Your account and content</h2>
        <p>
          Keep sign-in links and correction keys private. You remain responsible
          for your submitted content. Do not submit another person’s
          confidential information or use the service to harass others.
        </p>
        <h2>Pilot availability</h2>
        <p>
          This community tool is being tested. Availability may be interrupted.
          Export a copy of your history when you need one.
        </p>
        <h2>Privacy and deletion</h2>
        <p>
          Read <a href="/privacy">Privacy</a> for storage, access and deletion
          behavior. Account deletion has a seven-day recovery period.
        </p>
        {contact && (
          <p>
            Contact: <a href={`mailto:${contact}`}>{contact}</a>.
          </p>
        )}
      </section>
    </main>
  );
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Terms" };
