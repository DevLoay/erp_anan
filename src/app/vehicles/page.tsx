import { ResourcePage } from "@/components/ui/ResourcePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default function VehiclesPage() {
  return <ResourcePage resource={resources.vehicles} />;
}
