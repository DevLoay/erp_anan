import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  return <ResourceModulePage resource={resources.invoices} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
