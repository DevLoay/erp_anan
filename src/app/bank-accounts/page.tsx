import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage() {
  return <ResourceModulePage resource={resources["bank-accounts"]} analyticsKey="finance" backHref="/finance" backLabel="رجوع للماليات" />;
}
