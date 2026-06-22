import { ProjectSettingsView, ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { redirectLegacyProjectSlug } from "@/lib/projects/legacyProjectRedirect";
import { getProjectWorkspace } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectSettingsPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  redirectLegacyProjectSlug(projectId, query);
  const data = await getProjectWorkspace(projectId);
  if (data.status !== "online") return <ProjectStateCard data={data} />;
  return <ProjectSettingsView data={data} />;
}
