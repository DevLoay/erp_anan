import { AdminDashboardOldClient } from "@/components/dashboard/AdminDashboardOldClient";
import { getAdminDashboardOldData, resolveAdminDashboardFilters } from "@/lib/dashboard/getAdminDashboardOldData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const filters = await resolveAdminDashboardFilters(await searchParams);
  const data = await getAdminDashboardOldData(filters);
  return <AdminDashboardOldClient data={data} />;
}
