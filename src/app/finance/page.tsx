import { FinanceOverviewClient } from "@/components/finance/FinanceModulePageClient";
import { getFinanceOverviewData, resolveFinanceFilters } from "@/lib/finance/financePages";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinancePage({ searchParams }: PageProps) {
  const filters = resolveFinanceFilters(await searchParams);
  const data = await getFinanceOverviewData(filters);
  return <FinanceOverviewClient data={data} />;
}
