import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function RiderWarningsPage() {
  return <ResourceModulePage resource={resources["driver-warnings"]} analyticsKey="drivers" backHref="/hr" backLabel="رجوع للموارد البشرية" />;
}
