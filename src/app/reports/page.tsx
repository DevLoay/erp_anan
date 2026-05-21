import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getFilterOptions, getRiderKpiReport, resolveFilters } from "@/lib/reporting";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const reportCards = [
  {
    title: "تقارير الأداء اليومية",
    body: "طلبات، ساعات عمل، التزام، إلغاء ورفض من التقارير المستوردة.",
    href: "/daily-reports",
    color: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    title: "KPI المناديب",
    body: "قراءة أداء المندوب وربطه بالتارجت والتنبيهات والمهام.",
    href: "/rider-kpi",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    title: "تحليل الأداء",
    body: "تحليل المدن والمشاريع وأسباب الضعف.",
    href: "/performance-analysis",
    color: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    title: "ترتيب المدن",
    body: "ترتيب المدن حسب الشهر والمشروع والتحقيق الفعلي.",
    href: "/city-ranking",
    color: "border-violet-200 bg-violet-50 text-violet-800",
  },
];

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [kpi, analytics] = await Promise.all([getRiderKpiReport(filters), getPageAnalytics("reports")]);

  return (
    <PageShell
      title="التقارير العامة"
      description="مركز تقارير متصل ببيانات التشغيل الحقيقية: التقارير اليومية، مؤشرات الأداء، المخالفات، المهام والتنبيهات."
    >
      <PageAnalyticsSection analytics={analytics} />

      <ReportFilterBar filters={filters} options={options} resetHref="/reports" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي الطلبات" value={kpi.summary.totalOrders} tone="sky" />
        <MetricCard label="مناديب مؤهلين" value={kpi.summary.validRiders} tone="emerald" />
        <MetricCard label="مناديب غير مؤهلين" value={kpi.summary.invalidRiders} tone="red" />
        <MetricCard label="متوسط On-Time" value={`${kpi.summary.avgOnTime}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((card) => (
          <Link key={card.href} href={card.href} className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 ${card.color}`}>
            <h3 className="text-base font-black">{card.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6">{card.body}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5">
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">التقارير اليومية</h2>
          <ResourceWorkspace resource={resources["daily-reports"]} compact />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">مخالفات المناديب</h2>
          <ResourceWorkspace resource={resources.violations} compact />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">مهام المشرفين</h2>
          <ResourceWorkspace resource={resources.tasks} compact />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">التنبيهات</h2>
          <ResourceWorkspace resource={resources.notifications} compact />
        </section>
      </div>
    </PageShell>
  );
}
