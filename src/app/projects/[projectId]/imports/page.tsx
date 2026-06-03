import { ProjectImportsView, ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { getProjectImportTemplates } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectImportsPage({ params }: PageProps) {
  const { projectId } = await params;
  const data = await getProjectImportTemplates(projectId);
  if (data.workspace.status !== "online") return <ProjectStateCard data={data.workspace} />;
  return (
    <ProjectImportsView
      data={data.workspace}
      templates={data.templates}
      applications={data.applications}
      projects={data.projects}
      allowedTypes={data.allowedTypes ?? []}
    />
  );
}
