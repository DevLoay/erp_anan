import { RankSettingsClient } from "@/components/applications/RankSettingsClient";
import { getRankSettingsData, resolveRankSettingFilters } from "@/lib/applications/rankSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationProjectRankSettingsPage({ params, searchParams }: PageProps) {
  const [{ id, projectId }, rawParams] = await Promise.all([params, searchParams]);
  const filters = resolveRankSettingFilters({ ...rawParams, applicationId: id, applicationProjectId: projectId });
  const data = await getRankSettingsData(filters);
  return (
    <RankSettingsClient
      data={data}
      basePath={`/applications/${id}/projects/${projectId}/rank-settings`}
      lockedApplicationId={id}
      lockedProjectId={projectId}
    />
  );
}
