import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function KeetaTemplatePage() {
  return <ResourceModulePage resource={resources["excel-mappings"]} analyticsKey="imports" backHref="/projects/keeta/imports" backLabel="رجوع لاستيراد Keeta" />;
}
