import { ProjectDashboardView, ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { redirectLegacyProjectSlug } from "@/lib/projects/legacyProjectRedirect";
import { getProjectWorkspace, type ProjectWorkspaceFilters } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function filtersFromParams(params: Record<string, string | string[] | undefined>): ProjectWorkspaceFilters {
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  return {
    month: value("month"),
    cityId: value("cityId"),
    supervisorId: value("supervisorId"),
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
  };
}

export default async function ProjectDashboardPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  redirectLegacyProjectSlug(projectId, query);
  const data = await getProjectWorkspace(projectId, filtersFromParams(query));
  if (data.status !== "online") return <ProjectStateCard data={data} />;
  return <ProjectDashboardView data={data} />;
}
