import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  return <ResourceModulePage resource={resources.receivables} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
