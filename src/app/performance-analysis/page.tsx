import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getCityRanking, getFilterOptions, getProjectPerformance, getRiderKpiReport, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PerformanceAnalysisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [kpi, cities, projects, analytics] = await Promise.all([
    getRiderKpiReport(filters),
    getCityRanking(filters),
    getProjectPerformance(filters),
    getPageAnalytics("performance-analysis"),
  ]);

  return (
    <PageShell
      title="تحليل الأداء"
      description="تحليل أداء المدن والمشاريع والمناديب باستخدام الأرقام الفعلية من Daily Reports وقواعد KPI."
    >
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} resetHref="/performance-analysis" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي الطلبات" value={kpi.summary.totalOrders} tone="sky" />
        <MetricCard label="مناديب مؤهلين" value={kpi.summary.validRiders} tone="emerald" />
        <MetricCard label="مناديب حرجين" value={kpi.summary.critical} tone="red" />
        <MetricCard label="متوسط On-Time" value={`${kpi.summary.avgOnTime}%`} tone="emerald" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-950">أفضل المدن</h2>
            <Link href="/city-ranking" className="text-sm font-black text-sky-700">
              عرض الترتيب الكامل
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {cities.slice(0, 5).map((city) => (
              <div key={`${city.cityId}:${city.appName}`} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-black text-slate-950">{city.cityName}</strong>
                  <span className="text-sm font-black text-emerald-700">{city.score}%</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {city.appName}، طلبات {city.orders}، تحقيق {city.achievement}%
                </p>
              </div>
            ))}
            {!cities.length ? <p className="text-sm font-bold text-slate-500">لا توجد بيانات مدن.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">أضعف مؤشرات تحتاج متابعة</h2>
          <div className="mt-4 space-y-3">
            {kpi.rows
              .filter((row) => !row.valid)
              .slice(-5)
              .map((row) => (
                <div key={row.driverId} className="rounded-md border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm font-black text-red-950">{row.driverName}</strong>
                    <span className="text-sm font-black text-red-700">{row.score}%</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-red-700">{row.reasons.slice(0, 3).join("، ") || "مؤشر غير طبيعي"}</p>
                </div>
              ))}
            {!kpi.rows.filter((row) => !row.valid).length ? <p className="text-sm font-bold text-slate-500">لا توجد مؤشرات حرجة في الفلاتر الحالية.</p> : null}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">أداء المشاريع والتطبيقات</h2>
        <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">المشروع</th>
                <th className="px-4 py-3">التطبيق</th>
                <th className="px-4 py-3">المناديب</th>
                <th className="px-4 py-3">مؤهل / غير مؤهل</th>
                <th className="px-4 py-3">الطلبات</th>
                <th className="px-4 py-3">تحقيق</th>
                <th className="px-4 py-3">On-Time</th>
                <th className="px-4 py-3">إلغاء</th>
                <th className="px-4 py-3">رفض</th>
                <th className="px-4 py-3">النتيجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => (
                <tr key={project.key} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-black">{project.projectName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.appName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.riders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    <span className="text-emerald-700">{project.validRiders}</span>
                    <span className="mx-1 text-slate-400">/</span>
                    <span className="text-red-700">{project.invalidRiders}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{project.orders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.achievement}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.onTimeRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.cancellationRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{project.rejectionRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{project.score}%</td>
                </tr>
              ))}
              {!projects.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-500">
                    لا توجد بيانات مشاريع مطابقة للفلاتر الحالية.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
