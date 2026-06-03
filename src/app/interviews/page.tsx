import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  return <ResourceModulePage resource={resources.interviews} analyticsKey="drivers" backHref="/hr" backLabel="رجوع للموارد البشرية" />;
}
