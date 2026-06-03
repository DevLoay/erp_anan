import { CityOldPagesClient } from "@/components/cities/CityOldPagesClient";
import { getAccessScope } from "@/lib/auth/accessScope";
import { getCityOldPagesData, resolveCityPageFilters } from "@/lib/cities/getCityOldPagesData";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CityRankingPage({ searchParams }: PageProps) {
  const accessScope = await getAccessScope(await headers());
  const { filters, options } = await resolveCityPageFilters(await searchParams, accessScope);
  const data = await getCityOldPagesData(filters, options);
  return <CityOldPagesClient data={data} mode="ranking" />;
}
