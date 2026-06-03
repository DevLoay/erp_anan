import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function VatPage() {
  return <ResourceModulePage resource={resources["vat-records"]} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
