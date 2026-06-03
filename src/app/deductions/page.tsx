import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function DeductionsPage() {
  return <ResourceModulePage resource={resources.deductions} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
