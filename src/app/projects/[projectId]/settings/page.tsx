import { ProjectSettingsView, ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { getProjectWorkspace } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { projectId } = await params;
  const data = await getProjectWorkspace(projectId);
  if (data.status !== "online") return <ProjectStateCard data={data} />;
  return <ProjectSettingsView data={data} />;
}
