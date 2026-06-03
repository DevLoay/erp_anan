import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function UploadedReportsPage() {
  return <ResourceModulePage resource={resources["uploaded-reports"]} analyticsKey="imports" backHref="/imports" backLabel="رجوع للاستيراد" />;
}
