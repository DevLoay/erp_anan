import { headers } from "next/headers";
import { DriverViolationsClient } from "@/components/violations/DriverViolationsClient";
import { getDriverViolationsPageData, resolveDriverViolationFilters } from "@/lib/violations/driverViolations";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ViolationsPage({ searchParams }: PageProps) {
  const filters = resolveDriverViolationFilters(await searchParams);
  const data = await getDriverViolationsPageData(filters, await headers());
  return <DriverViolationsClient data={data} />;
}
