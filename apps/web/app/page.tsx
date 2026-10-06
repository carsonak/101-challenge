import { parseServerConfig } from '@challenge/contracts';

export const dynamic = 'force-dynamic';

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
        <h2 id="status">Getting ready</h2>
        <p>
          The challenge tracker is under development. Account creation and
          challenge enrollment will be available in a future update.
        </p>
      </section>
    </main>
  );
}
