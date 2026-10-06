import TrackerScreen from "../../../components/tracker";
/** Resource screens never cache participant state. */
export const dynamic = "force-dynamic";
/** Render the resource flow; APIs independently authorize every lookup and mutation. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const value = await params;
  return <TrackerScreen view="season" id={value.id} />;
}
