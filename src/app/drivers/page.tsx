import { DriverManagementClient } from "@/components/drivers/DriverManagementClient";
import { getDriverManagementData, resolveDriverManagementFilters } from "@/lib/drivers/getDriverManagementData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DriversPage({ searchParams }: PageProps) {
  const filters = resolveDriverManagementFilters(await searchParams);
  const data = await getDriverManagementData(filters);
  return <DriverManagementClient data={data} />;
}
