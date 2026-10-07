import TrackerScreen from "../../components/tracker";
/** Owner-only home view; server APIs independently authorize every projection. */
export default function Page() {
  return <TrackerScreen view="home" />;
}
