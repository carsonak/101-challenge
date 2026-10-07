import TrackerScreen from "../../components/tracker";
/** Owner-only notifications view; server APIs independently authorize every projection. */
export default function Page() {
  return <TrackerScreen view="notifications" />;
}
