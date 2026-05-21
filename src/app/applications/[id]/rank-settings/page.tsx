import { RankSettingsClient } from "@/components/applications/RankSettingsClient";
import { getRankSettingsData, resolveRankSettingFilters } from "@/lib/applications/rankSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationRankSettingsPage({ params, searchParams }: PageProps) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams]);
  const filters = resolveRankSettingFilters({ ...rawParams, applicationId: id });
  const data = await getRankSettingsData(filters);
  return <RankSettingsClient data={data} basePath={`/applications/${id}/rank-settings`} lockedApplicationId={id} />;
}
