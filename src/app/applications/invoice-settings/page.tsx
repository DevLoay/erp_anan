import { InvoiceSettingsClient } from "@/components/applications/InvoiceSettingsClient";
import { getInvoiceSettingsData, resolveInvoiceSettingFilters } from "@/lib/applications/invoiceSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoiceSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = resolveInvoiceSettingFilters(params);
  const data = await getInvoiceSettingsData(filters);
  return <InvoiceSettingsClient data={data} basePath="/applications/invoice-settings" />;
}
