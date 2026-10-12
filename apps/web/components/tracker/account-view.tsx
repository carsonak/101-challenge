"use client";
import AccountScreen from "../account-screen";
import type { TrackerViewContext } from "./context";
/** Render account using current controller state and explicit actions. */
export function AccountView(context: TrackerViewContext) {
  const { account, providers, loaded, authAction, oauth, view } = context;
  return (
    <>
      {view === "account" &&
        (account ? (
          <AccountScreen
            account={account}
            providers={providers}
            act={authAction}
            oauth={oauth}
          />
        ) : (
          loaded && <a href="/login">Log in to view your account</a>
        ))}{" "}
    </>
  );
}
