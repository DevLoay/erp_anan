import { PayrollOldPageClient } from "@/components/payroll/PayrollOldPageClient";
import { getPayrollOldPageData, resolvePayrollOldFilters } from "@/lib/payroll/getPayrollOldPageData";
import { getAccessScope } from "@/lib/auth/accessScope";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollPage({ searchParams }: PageProps) {
  const [params, accessScope] = await Promise.all([searchParams, getAccessScope(await headers())]);
  const data = await getPayrollOldPageData(resolvePayrollOldFilters(params), accessScope);
  return <PayrollOldPageClient data={data} />;
}
