import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  return <ResourceModulePage resource={resources.shifts} analyticsKey="daily-reports" backHref="/attendance" backLabel="رجوع للحضور" />;
}
