import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function SupervisorTasksPage() {
  return <ResourceModulePage resource={resources.tasks} analyticsKey="supervisors" backHref="/supervisors" backLabel="رجوع للمشرفين" />;
}
