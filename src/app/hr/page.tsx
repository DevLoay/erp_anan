import { HumanResourcesClient } from "@/components/hr/HumanResourcesClient";
import { getHumanResourcesData, resolveHumanResourcesFilters } from "@/lib/hr/getHumanResourcesData";
import { getAccessScope } from "@/lib/auth/accessScope";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HumanResourcesPage({ searchParams }: PageProps) {
  const [params, accessScope] = await Promise.all([searchParams, getAccessScope(await headers())]);
  const filters = resolveHumanResourcesFilters(params);
  const data = await getHumanResourcesData(filters, accessScope);
  return <HumanResourcesClient data={data} />;
}
