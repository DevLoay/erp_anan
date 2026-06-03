import { DailyReportsOldPageClient } from "@/components/daily-reports/DailyReportsOldPageClient";
import { getAccessScope } from "@/lib/auth/accessScope";
import { getDailyReportsOldPageData, resolveDailyReportsFilters } from "@/lib/daily-reports/getDailyReportsOldPageData";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DailyReportsPage({ searchParams }: PageProps) {
  const accessScope = await getAccessScope(await headers());
  const filters = await resolveDailyReportsFilters(await searchParams, accessScope);
  const data = await getDailyReportsOldPageData(filters);
  return <DailyReportsOldPageClient data={data} />;
}
