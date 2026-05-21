import { InvoiceSettingsClient } from "@/components/applications/InvoiceSettingsClient";
import { getInvoiceSettingsData, resolveInvoiceSettingFilters } from "@/lib/applications/invoiceSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationInvoiceSettingsPage({ params, searchParams }: PageProps) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams]);
  const filters = resolveInvoiceSettingFilters({ ...rawParams, applicationId: id });
  const data = await getInvoiceSettingsData(filters);
  return <InvoiceSettingsClient data={data} basePath={`/applications/${id}/invoice-settings`} lockedApplicationId={id} />;
}
