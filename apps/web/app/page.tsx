import { parseServerConfig } from "@challenge/contracts";

/** Next.js route policy requesting a fresh render of the landing page for each request. */
export const dynamic = "force-dynamic";

/**
 * Landing page rendered by Next.js for `/`, using APP_DISPLAY_NAME for branding.
 * Requires valid server configuration; invalid settings cause rendering to fail.
 */
export default function Home() {
  const { APP_DISPLAY_NAME } = parseServerConfig(process.env);
  return (
    <main>
      <p className="eyebrow">101 reporting days · Your goals · Your pace</p>
      <h1>{APP_DISPLAY_NAME}</h1>
      <p>
        A place to build a steady practice, record your progress, and learn with
        the community.
      </p>
      <section aria-labelledby="status">
        <h2 id="status">Make a little progress, one report at a time</h2>
        <p>
          Join a published season, choose your goals, and record 101 reporting
          days. Your reports and retained history stay private.
        </p>
        <p>
          <a className="button" href="/seasons">
            Explore seasons
          </a>{" "}
          <a className="button secondary" href="/signup">
            Create account
          </a>{" "}
          <a href="/login">Sign in</a>
        </p>
      </section>
    </main>
  );
}
