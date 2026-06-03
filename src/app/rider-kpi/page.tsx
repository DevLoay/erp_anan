import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getFilterOptions, getRiderKpiReport, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function dailyReportsHref(driverId: string, month: string) {
  const params = new URLSearchParams({ riderId: driverId });
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    params.set("fromDate", `${match[1]}-${match[2]}-01`);
    params.set("toDate", new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10));
  }
  return `/daily-reports?${params.toString()}`;
}

export default async function RiderKpiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [report, analytics] = await Promise.all([getRiderKpiReport(filters), getPageAnalytics("rider-kpi")]);

  return (
    <PageShell
      title="KPI المناديب"
      description="مؤشرات أداء المناديب محسوبة من التقارير اليومية والتارجت المحفوظ في إعدادات النظام."
    >
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} resetHref="/rider-kpi" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي المناديب" value={report.summary.totalRiders} hint={filters.month} />
        <MetricCard label="مناديب مؤهلين" value={report.summary.validRiders} tone="emerald" />
        <MetricCard label="مناديب غير مؤهلين" value={report.summary.invalidRiders} tone="red" />
        <MetricCard label="إجمالي الطلبات" value={report.summary.totalOrders} tone="sky" />
        <MetricCard label="ساعات العمل" value={report.summary.totalHours} />
        <MetricCard label="On-Time %" value={`${report.summary.avgOnTime}%`} tone="emerald" />
        <MetricCard label="Cancellation %" value={`${report.summary.avgCancellation}%`} tone="amber" />
        <MetricCard label="Rejection %" value={`${report.summary.avgRejection}%`} tone="amber" />
      </div>

      <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              <th className="px-4 py-3">المندوب</th>
              <th className="px-4 py-3">المدينة</th>
              <th className="px-4 py-3">المشروع</th>
              <th className="px-4 py-3">المشرف</th>
              <th className="px-4 py-3">الطلبات</th>
              <th className="px-4 py-3">الساعات</th>
              <th className="px-4 py-3">On-Time</th>
              <th className="px-4 py-3">إلغاء</th>
              <th className="px-4 py-3">رفض</th>
              <th className="px-4 py-3">تحقيق</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">أسباب التحذير</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.length ? (
              report.rows.map((row) => (
                <tr key={row.driverId} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-black text-slate-950">{row.driverName}</div>
                    <div className="text-xs font-bold text-slate-500">{row.driverCode}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.cityName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    <div>{row.projectName}</div>
                    <div className="text-xs text-slate-500">{row.appName}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.supervisorName}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.orders}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.workingHours}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.onTimeRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.cancellationRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.rejectionRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.achievement}%</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge value={row.valid ? "valid" : row.status} />
                  </td>
                  <td className="min-w-72 px-4 py-3">
                    {row.reasons.length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.reasons.slice(0, 4).map((reason) => (
                          <span key={reason} className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700">طبيعي</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={dailyReportsHref(row.driverId, filters.month)} className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700">
                        تقرير المندوب
                      </Link>
                      <Link href={`/supervisor-tasks?q=${encodeURIComponent(row.driverName)}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                        مهمة للمشرف
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center font-bold text-slate-500">
                  لا توجد بيانات مطابقة للفلاتر الحالية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
