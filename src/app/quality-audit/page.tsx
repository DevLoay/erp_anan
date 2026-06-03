import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function QualityAuditPage() {
  return <ResourceModulePage resource={resources["quality-audits"]} analyticsKey="reports" backHref="/management-reports" backLabel="رجوع للتقارير" />;
}
