import TrackerScreen from "../../../components/tracker";
/** Private screens render per request; participant data loads through authorized APIs. */
export const dynamic = "force-dynamic";
/** Render the admin-corrections browser flow. */
export default function Page() {
  return <TrackerScreen view="admin-corrections" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Corrections" };
