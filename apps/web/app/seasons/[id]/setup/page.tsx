import TrackerScreen from "../../../../components/tracker";
/** Setup-only page excludes lifecycle controls and previous-attempt history. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrackerScreen view="setup" id={id} />;
}
