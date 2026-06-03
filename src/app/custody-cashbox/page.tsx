import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function CustodyCashboxPage() {
  return <ResourceModulePage resource={resources["cashbox-entries"]} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
