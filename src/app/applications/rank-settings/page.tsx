import { RankSettingsClient } from "@/components/applications/RankSettingsClient";
import { getRankSettingsData, resolveRankSettingFilters } from "@/lib/applications/rankSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RankSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = resolveRankSettingFilters(params);
  const data = await getRankSettingsData(filters);
  return <RankSettingsClient data={data} basePath="/applications/rank-settings" />;
}
