import { headers } from "next/headers";
import { SupervisorTasksClient } from "@/components/supervisor-tasks/SupervisorTasksClient";
import { getSupervisorTasksData, resolveSupervisorTaskFilters } from "@/lib/supervisor-tasks/getSupervisorTasksData";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function SupervisorTasksPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const filters = resolveSupervisorTaskFilters(params);
  const data = await getSupervisorTasksData(filters, await headers());
  return <SupervisorTasksClient data={data} />;
}
