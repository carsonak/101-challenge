import TrackerScreen from "../../../../components/tracker";
/** Dedicated versioned season editor. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrackerScreen view="admin-seasons" id={id} />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Manage seasons" };
