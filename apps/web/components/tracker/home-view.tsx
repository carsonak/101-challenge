"use client";
import HomeScreen from "../home-screen";
import type { TrackerViewContext } from "./context";
/** Render home using current controller state and explicit actions. */
export function HomeView(context: TrackerViewContext) {
  const { account, history, seasons, view } = context;
  return (
    <>
      {view === "home" && account && (
        <HomeScreen history={history} seasons={seasons} />
      )}{" "}
    </>
  );
}
