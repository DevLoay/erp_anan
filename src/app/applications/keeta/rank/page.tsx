import { KeetaRankClient } from "@/components/applications/KeetaRankClient";
import { getKeetaRankData, resolveKeetaRankFilters } from "@/lib/applications/keetaRank";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KeetaRankPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = resolveKeetaRankFilters(params);
  const data = await getKeetaRankData(filters);
  return <KeetaRankClient data={data} />;
}
