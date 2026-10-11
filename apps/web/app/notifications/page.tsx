import TrackerScreen from "../../components/tracker";
/** Owner-only notifications view; server APIs independently authorize every projection. */
export default function Page() {
  return <TrackerScreen view="notifications" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Notifications" };
