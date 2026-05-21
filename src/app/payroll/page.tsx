import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { PayrollGenerateButton } from "@/components/payroll/PayrollGenerateButton";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getFilterOptions, getPayrollReadiness, resolveFilters } from "@/lib/reporting";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [readiness, analytics] = await Promise.all([getPayrollReadiness(filters.month), getPageAnalytics("payroll")]);

  return (
    <PageShell
      title="مسير الرواتب"
      description="إعداد ومراجعة مسير الرواتب حسب الشهر، مع ربط السلف والخصومات والحالة المالية."
    >
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} showStatus={false} resetHref="/payroll" />

      <PayrollGenerateButton filters={filters} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="سجلات المسير" value={readiness.count} />
        <MetricCard label="مسودة" value={readiness.draft} tone="amber" />
        <MetricCard label="معتمد/مدفوع/مقفل" value={readiness.approved + readiness.paid + readiness.locked} tone="emerald" />
        <MetricCard label="صافي الرواتب" value={readiness.net} tone="sky" />
        <MetricCard label="إجمالي الأساسي" value={readiness.basic} />
        <MetricCard label="خصومات المسير" value={readiness.payrollDeductions} tone="red" />
        <MetricCard label="سلف معتمدة" value={readiness.approvedAdvancesAmount} tone="amber" />
        <MetricCard label="خصومات مالية" value={readiness.deductionAmount} tone="red" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">إعدادات المسير</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              قواعد الراتب والتارجت والخصومات يتم تعديلها من إعدادات البرنامج، وتنعكس على KPI والتقارير والمسير.
            </p>
          </div>
          <Link href="/payroll/settings" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white">
            فتح إعدادات المسير والتارجت
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">سجلات المسير</h2>
        <ResourceWorkspace resource={resources.payroll} />
      </section>
    </PageShell>
  );
}
