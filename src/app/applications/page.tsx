import { ApplicationsCenterClient } from "@/components/applications/ApplicationsCenterClient";
import { getApplicationCenterData } from "@/lib/applications/getApplicationCenterData";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const data = await getApplicationCenterData();
  return <ApplicationsCenterClient data={data} />;
}
