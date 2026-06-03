import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function AccountMovementPage() {
  return <ResourceModulePage resource={resources["app-account-movements"]} analyticsKey="applications" backHref="/applications" backLabel="رجوع لمركز التطبيقات" />;
}
