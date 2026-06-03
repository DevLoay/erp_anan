import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  return <ResourceModulePage resource={resources.payments} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
