import { HumanResourcesClient } from "@/components/hr/HumanResourcesClient";
import { getHumanResourcesData, resolveHumanResourcesFilters } from "@/lib/hr/getHumanResourcesData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HumanResourcesPage({ searchParams }: PageProps) {
  const filters = resolveHumanResourcesFilters(await searchParams);
  const data = await getHumanResourcesData(filters);
  return <HumanResourcesClient data={data} />;
}
