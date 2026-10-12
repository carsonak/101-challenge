import uiStyles from "./../styles/ui.module.css";
/** Navigation for an unavailable route. */
export default function NotFound() {
  return (
    <main>
      <h1>Page unavailable</h1>
      <p>This page may have moved, or you may need to sign in.</p>
      <a className={uiStyles.button} href="/home">
        Go to Home
      </a>
    </main>
  );
}
