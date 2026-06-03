import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function RevenuesPage() {
  return <ResourceModulePage resource={resources.revenues} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
