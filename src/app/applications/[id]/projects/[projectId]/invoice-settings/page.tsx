import { InvoiceSettingsClient } from "@/components/applications/InvoiceSettingsClient";
import { getInvoiceSettingsData, resolveInvoiceSettingFilters } from "@/lib/applications/invoiceSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationProjectInvoiceSettingsPage({ params, searchParams }: PageProps) {
  const [{ id, projectId }, rawParams] = await Promise.all([params, searchParams]);
  const filters = resolveInvoiceSettingFilters({ ...rawParams, applicationId: id, applicationProjectId: projectId });
  const data = await getInvoiceSettingsData(filters);
  return (
    <InvoiceSettingsClient
      data={data}
      basePath={`/applications/${id}/projects/${projectId}/invoice-settings`}
      lockedApplicationId={id}
      lockedProjectId={projectId}
    />
  );
}
