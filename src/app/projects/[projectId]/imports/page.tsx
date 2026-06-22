import { ProjectImportsView, ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { redirectLegacyProjectSlug } from "@/lib/projects/legacyProjectRedirect";
import { getProjectImportTemplates } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function filtersFromParams(params: Record<string, string | string[] | undefined>) {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  return { month: value("month"), cityId: value("cityId"), supervisorId: value("supervisorId"), dateFrom: value("dateFrom"), dateTo: value("dateTo") };
}

export default async function ProjectImportsPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  redirectLegacyProjectSlug(projectId, query);
  const data = await getProjectImportTemplates(projectId, filtersFromParams(query));
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
