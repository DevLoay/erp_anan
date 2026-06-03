import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function BackupRestorePage() {
  return <ResourceModulePage resource={resources["backup-records"]} analyticsKey="settings" backHref="/settings" backLabel="رجوع للإعدادات" />;
}
