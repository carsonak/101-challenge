import TrackerScreen from "../../components/tracker";
/** Private screens render per request; participant data loads through authorized APIs. */
export const dynamic = "force-dynamic";
/** Render the seasons browser flow. */
export default function Page() {
  return <TrackerScreen view="seasons" />;
}
