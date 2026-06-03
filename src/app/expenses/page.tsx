import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  return <ResourceModulePage resource={resources.expenses} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
