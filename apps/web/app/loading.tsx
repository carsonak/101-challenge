import { WaitingMessage } from "../components/waiting-message";
import screensStyles from "./../styles/screens.module.css";
import uiStyles from "./../styles/ui.module.css";
/** Accessible route-shaped skeleton contains no cached private content. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading page">
      <div
        className={`${screensStyles.skeleton} ${screensStyles["skeleton-heading"]}`}
      />
      <div
        className={`${screensStyles.skeleton} ${screensStyles["skeleton-card"]}`}
      />
      <div className={screensStyles.skeleton} />
      <WaitingMessage />
      <span role="status" className={uiStyles["sr-only"]}>
        Loading…
      </span>
    </main>
  );
}
