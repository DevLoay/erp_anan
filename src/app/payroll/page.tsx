import { PayrollOldPageClient } from "@/components/payroll/PayrollOldPageClient";
import { getPayrollOldPageData, resolvePayrollOldFilters } from "@/lib/payroll/getPayrollOldPageData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getPayrollOldPageData(resolvePayrollOldFilters(params));
  return <PayrollOldPageClient data={data} />;
}
