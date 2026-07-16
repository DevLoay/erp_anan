import { DriverManagementClient } from "@/components/drivers/DriverManagementClient";
import { getDriverManagementData, resolveDriverManagementFilters } from "@/lib/drivers/getDriverManagementData";
import { headers } from "next/headers";
import { getAccessScope } from "@/lib/auth/accessScope";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DriversPage({ searchParams }: PageProps) {
  const [params, accessScope] = await Promise.all([searchParams, getAccessScope(await headers())]);
  const filters = resolveDriverManagementFilters(params);
  const data = await getDriverManagementData(filters, accessScope);
  return <DriverManagementClient data={data} />;
}
