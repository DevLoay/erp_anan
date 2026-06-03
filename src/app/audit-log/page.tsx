import { ResourcePage } from "@/components/ui/ResourcePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default function AuditLogPage() {
  return <ResourcePage resource={resources["audit-logs"]} />;
}

