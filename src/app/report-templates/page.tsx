import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ReportTemplatesPage() {
  return <ResourceModulePage resource={resources["report-templates"]} analyticsKey="reports" backHref="/management-reports" backLabel="رجوع للتقارير" />;
}
