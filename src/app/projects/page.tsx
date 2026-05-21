import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getFilterOptions, getProjectPerformance, resolveFilters } from "@/lib/reporting";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [performance, analytics] = await Promise.all([getProjectPerformance(filters), getPageAnalytics("projects")]);
  const totalOrders = performance.reduce((sum, row) => sum + row.orders, 0);
  const riders = performance.reduce((sum, row) => sum + row.riders, 0);

  return (
    <PageShell
      title={resources.projects.title}
      description="المشاريع والتطبيقات الموجودة مع أداء فعلي من التقارير اليومية، بالإضافة إلى إدارة سجلات المشاريع."
    >
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} showStatus={false} resetHref="/projects" />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="مشاريع لها أداء" value={performance.length} />
        <MetricCard label="إجمالي المناديب" value={riders} tone="emerald" />
        <MetricCard label="إجمالي الطلبات" value={totalOrders} tone="sky" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">أداء المشاريع الموجودة</h2>
        <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">المشروع</th>
                <th className="px-4 py-3">التطبيق</th>
                <th className="px-4 py-3">المناديب</th>
                <th className="px-4 py-3">مؤهل</th>
                <th className="px-4 py-3">غير مؤهل</th>
                <th className="px-4 py-3">الطلبات</th>
                <th className="px-4 py-3">التحقيق</th>
                <th className="px-4 py-3">النتيجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {performance.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.projectName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.appName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.riders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-700">{row.validRiders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-red-700">{row.invalidRiders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.orders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.achievement}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.score}%</td>
                </tr>
              ))}
              {!performance.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-bold text-slate-500">
                    لا توجد بيانات أداء للمشاريع حسب الفلاتر الحالية.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">إدارة المشاريع</h2>
        <ResourceWorkspace resource={resources.projects} />
      </section>
    </PageShell>
  );
}
