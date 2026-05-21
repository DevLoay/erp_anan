import { CityOldPagesClient } from "@/components/cities/CityOldPagesClient";
import { getCityOldPagesData, resolveCityPageFilters } from "@/lib/cities/getCityOldPagesData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CityRankingPage({ searchParams }: PageProps) {
  const { filters, options } = await resolveCityPageFilters(await searchParams);
  const data = await getCityOldPagesData(filters, options);
  return <CityOldPagesClient data={data} mode="ranking" />;
}
