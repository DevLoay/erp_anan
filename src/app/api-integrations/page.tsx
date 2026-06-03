import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ApiIntegrationsPage() {
  return <ResourceModulePage resource={resources["api-integrations"]} analyticsKey="settings" backHref="/settings" backLabel="رجوع للإعدادات" />;
}
