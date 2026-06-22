import { AdvancesPageClient } from "@/components/advances/AdvancesPageClient";
import { getAdvancesPageData, resolveAdvancesPageFilters } from "@/lib/advances/getAdvancesPageData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdvancesPage({ searchParams }: PageProps) {
  const filters = resolveAdvancesPageFilters(await searchParams);
  const data = await getAdvancesPageData(filters);
  return <AdvancesPageClient data={data} />;
}
