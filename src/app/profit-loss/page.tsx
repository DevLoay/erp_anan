import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ProfitLossPage() {
  return <ResourceModulePage resource={resources["profit-loss"]} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
