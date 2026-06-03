import { ResourceModulePage } from "@/components/ui/ResourceModulePage";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ContractsSponsorshipPage() {
  return <ResourceModulePage resource={resources["driver-contracts"]} analyticsKey="drivers" backHref="/hr" backLabel="رجوع للموارد البشرية" />;
}
