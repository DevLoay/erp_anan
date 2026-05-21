import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getCityRanking, getFilterOptions, getProjectPerformance, getRiderKpiReport, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ManagementReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [kpi, cityRows, projectRows, analytics] = await Promise.all([
    getRiderKpiReport(filters),
    getCityRanking(filters),
    getProjectPerformance(filters),
    getPageAnalytics("management-reports"),
  ]);
  const bestRiders = kpi.rows.slice(0, 5);
  const weakRiders = [...kpi.rows].sort((a, b) => a.score - b.score).slice(0, 5);

  return (
    <PageShell title="تقارير الإدارة" description="ملخص إداري للأفضل والأضعف في المدن والمشاريع والمناديب بناء على البيانات الفعلية.">
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} resetHref="/management-reports" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي الطلبات" value={kpi.summary.totalOrders} tone="sky" />
        <MetricCard label="مؤهلين" value={kpi.summary.validRiders} tone="emerald" />
        <MetricCard label="غير مؤهلين" value={kpi.summary.invalidRiders} tone="red" />
        <MetricCard label="ساعات العمل" value={kpi.summary.totalHours} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReportList title="أفضل المدن" rows={cityRows.slice(0, 5).map((row) => ({ label: row.cityName, sub: `${row.appName} - تحقيق ${row.achievement}%`, value: `${row.score}%`, status: row.status }))} />
        <ReportList title="أفضل المشاريع" rows={projectRows.slice(0, 5).map((row) => ({ label: row.projectName, sub: `${row.appName} - طلبات ${row.orders}`, value: `${row.score}%`, status: row.score >= 75 ? "GOOD" : "WARNING" }))} />
        <ReportList title="أفضل المناديب" rows={bestRiders.map((row) => ({ label: row.driverName, sub: `${row.cityName} - ${row.appName}`, value: `${row.score}%`, status: row.status }))} />
        <ReportList title="مناديب تحتاج متابعة" rows={weakRiders.map((row) => ({ label: row.driverName, sub: row.reasons.slice(0, 2).join("، ") || row.cityName, value: `${row.score}%`, status: row.status }))} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/rider-kpi" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white">
          فتح KPI التفصيلي
        </Link>
        <Link href="/city-ranking" className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700">
          فتح ترتيب المدن
        </Link>
        <Link href="/performance-analysis" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
          فتح تحليل الأداء
        </Link>
      </div>
    </PageShell>
  );
}

function ReportList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; sub: string; value: string; status: string }[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={`${row.label}:${row.sub}`} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
            <div>
              <strong className="block text-sm font-black text-slate-950">{row.label}</strong>
              <span className="text-xs font-bold text-slate-500">{row.sub}</span>
            </div>
            <div className="flex items-center gap-2">
              <strong className="text-sm font-black text-slate-900">{row.value}</strong>
              <StatusBadge value={row.status} />
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm font-bold text-slate-500">لا توجد بيانات كافية.</p> : null}
      </div>
    </section>
  );
}
