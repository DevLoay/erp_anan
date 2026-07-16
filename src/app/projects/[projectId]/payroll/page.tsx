import { PayrollOldPageClient } from "@/components/payroll/PayrollOldPageClient";
import { HungerStationPayrollClient } from "@/components/payroll/HungerStationPayrollClient";
import { ProjectStateCard } from "@/components/projects/ProjectWorkspaceViews";
import { getPayrollOldPageData, resolvePayrollOldFilters } from "@/lib/payroll/getPayrollOldPageData";
import { redirectLegacyProjectSlug } from "@/lib/projects/legacyProjectRedirect";
import { getProjectWorkspace, type ProjectWorkspaceFilters } from "@/lib/projects/projectWorkspace";
import { getAccessScope } from "@/lib/auth/accessScope";
import { headers } from "next/headers";

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
  return { month: value("month"), cityId: value("cityId"), supervisorId: value("supervisorId"), dateFrom: value("dateFrom"), dateTo: value("dateTo") };
}

export default async function ProjectPayrollPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query, accessScope] = await Promise.all([params, searchParams, getAccessScope(await headers())]);
  redirectLegacyProjectSlug(projectId, query);
  const data = await getProjectWorkspace(projectId, filtersFromParams(query));
  if (data.status !== "online") return <ProjectStateCard data={data} />;

  if (data.project.applicationCode === "HUNGERSTATION") {
    return (
      <HungerStationPayrollClient
        initialMonth={data.filters.month}
        initialProjectCode={data.project.code}
        initialApplicationProjectId={data.project.id}
      />
    );
  }

  const payrollFilters = resolvePayrollOldFilters({
    ...query,
    projectId: data.project.id,
    cityId: query.cityId ?? data.project.cityId ?? "",
    month: query.month ?? data.filters.month,
  });
  const payrollData = await getPayrollOldPageData(payrollFilters, accessScope);

  return <PayrollOldPageClient data={payrollData} />;
}
