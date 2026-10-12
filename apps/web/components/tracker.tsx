"use client";
import uiStyles from "./../styles/ui.module.css";

import Loading from "../app/loading";
import { AccountView } from "./tracker/account-view";
import { AdminCorrectionsView } from "./tracker/admin-corrections-view";
import { AdminSeasonsView } from "./tracker/admin-seasons-view";
import { ChallengeView } from "./tracker/challenge-view";
import { useTrackerController } from "./tracker/controller";
import { HistoryView } from "./tracker/history-view";
import { HomeView } from "./tracker/home-view";
import { NotificationsView } from "./tracker/notifications-view";
import { SeasonView } from "./tracker/season-view";
import { SeasonsView } from "./tracker/seasons-view";
import { SetupView } from "./tracker/setup-view";
import { Toast } from "./ui";
/** Browser account and participant/admin flows; private data stays in session memory. */
export default function TrackerScreen(
  props: Parameters<typeof useTrackerController>[0]
) {
  const context = useTrackerController(props);
  const { loaded, message, error, dismiss, busy } = context;
  if (!loaded) return <Loading />;

  return (
    <main className={"tracker"}>
      <Toast message={message} error={error} dismiss={dismiss} />
      <fieldset className={"screen"} disabled={busy}>
        <legend className={uiStyles["sr-only"]}>Challenge controls</legend>
        <SeasonsView {...context} />
        <SeasonView {...context} />
        <HistoryView {...context} />
        <ChallengeView {...context} />
        <AccountView {...context} />
        <SetupView {...context} />
        <HomeView {...context} />
        <NotificationsView {...context} />
        <AdminSeasonsView {...context} />
        <AdminCorrectionsView {...context} />
      </fieldset>
      {!loaded && <p role="status">Loading…</p>}
    </main>
  );
}
