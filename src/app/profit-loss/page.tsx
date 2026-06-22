import { FinanceModulePageClient } from "@/components/finance/FinanceModulePageClient";
import { getFinanceModulePageData, resolveFinanceFilters } from "@/lib/finance/financePages";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProfitLossPage({ searchParams }: PageProps) {
  const filters = resolveFinanceFilters(await searchParams);
  const data = await getFinanceModulePageData("profit-loss", filters);
  return <FinanceModulePageClient data={data} />;
}
