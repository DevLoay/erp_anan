import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function TalabatTemplatePage() {
  return <ResourceModulePage resource={resources["excel-mappings"]} analyticsKey="imports" backHref="/imports/templates" backLabel="رجوع للقوالب" />;
}
