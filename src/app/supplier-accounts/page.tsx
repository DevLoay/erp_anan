import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function SupplierAccountsPage() {
  return <ResourceModulePage resource={resources["supplier-accounts"]} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
