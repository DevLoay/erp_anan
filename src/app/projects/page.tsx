import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { prisma } from "@/lib/prisma";
import { getFilterOptions, getProjectPerformance, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function projectRouteId(project: { id: string; code?: string | null; name?: string | null; application?: { code?: string | null; name?: string | null } | null }) {
  const key = [project.code, project.name, project.application?.code, project.application?.name].join(" ").toLowerCase().replace(/\s+/g, "");
  if (key.includes("keeta")) return "keeta";
  if (key.includes("hungerstation")) return "hungerstation";
  if (key.includes("talabat")) return "talabat";
  if (key.includes("ninja")) return "ninja";
  if (key.includes("toyou")) return "toyou";
  return project.id;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const options = await getFilterOptions();
  const filters = resolveFilters(params, options);
  const [performance, analytics, applicationProjects] = await Promise.all([
    getProjectPerformance(filters),
    getPageAnalytics("projects"),
    prisma.applicationProject.findMany({
      include: {
        application: { select: { name: true, code: true } },
        city: { select: { nameAr: true, nameEn: true } },
        _count: { select: { accounts: true, importBatches: true, payrollRuns: true } },
      },
      orderBy: [{ application: { name: "asc" } }, { city: { nameAr: "asc" } }, { name: "asc" }],
      take: 120,
    }).catch(() => []),
  ]);

  const totalOrders = performance.reduce((sum, row) => sum + row.orders, 0);
  const riders = performance.reduce((sum, row) => sum + row.riders, 0);
  const totalAccounts = applicationProjects.reduce((sum, row) => sum + row._count.accounts, 0);

  return (
    <PageShell
      title="المشاريع"
      description="مشاريع التشغيل المستقلة المبنية على ApplicationProject فقط؛ بدون الاعتماد على صفحات Project القديمة."
    >
      <PageAnalyticsSection analytics={analytics} />
      <ReportFilterBar filters={filters} options={options} showStatus={false} resetHref="/projects" />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="مشاريع التشغيل" value={applicationProjects.length} />
        <MetricCard label="حسابات التطبيقات" value={totalAccounts} tone="emerald" />
        <MetricCard label="إجمالي المناديب بالتقارير" value={riders} tone="sky" />
        <MetricCard label="إجمالي الطلبات" value={totalOrders} tone="amber" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">مساحات المشاريع المستقلة</h2>
            <p className="text-sm text-slate-500">كل كارت هنا يمثل ApplicationProject وليس Project legacy.</p>
          </div>
          <Link href="/settings/application-account-review" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">
            مراجعة ربط الحسابات
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {applicationProjects.map((project) => {
            const routeId = projectRouteId(project);
            const cityName = project.city?.nameAr || project.city?.nameEn || "كل المدن";
            return (
              <div key={project.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-950">{project.name}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{project.application.name} · {cityName}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{project.code}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-950">{project._count.accounts}</b>حساب</div>
                  <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-950">{project._count.importBatches}</b>استيراد</div>
                  <div className="rounded-xl bg-slate-50 p-2"><b className="block text-base text-slate-950">{project._count.payrollRuns}</b>مسير</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/projects/${routeId}/dashboard`} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white">التفاصيل</Link>
                  <Link href={`/projects/${routeId}/imports`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">استيراد</Link>
                  <Link href={`/projects/${routeId}/drivers`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">المناديب</Link>
                  <Link href={`/projects/${routeId}/accounts`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">الحسابات</Link>
                  <Link href={`/projects/${routeId}/invoices`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">الفواتير</Link>
                  <Link href={`/projects/${routeId}/payroll`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">المسير</Link>
                  <Link href={`/projects/${routeId}/reports`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">التقارير</Link>
                  <Link href={`/projects/${routeId}/settings`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">الإعدادات</Link>
                </div>
              </div>
            );
          })}
          {!applicationProjects.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500 md:col-span-2 xl:col-span-3">
              لا توجد مشاريع تشغيل مسجلة حتى الآن.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">أداء المشاريع</h2>
        <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {["المشروع", "التطبيق", "المناديب", "مؤهل", "غير مؤهل", "الطلبات", "التحقيق", "النتيجة"].map((header) => (
                  <th key={header} className="px-4 py-3">{header}</th>
                ))}
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
                    لا توجد بيانات أداء معتمدة حسب الفلاتر الحالية.
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
