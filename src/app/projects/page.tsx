import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProjectsData = Awaited<ReturnType<typeof getProjectsData>>;
type ProjectRow = ProjectsData["projects"][number];

const OPERATIONAL_APPLICATION_CODES = ["KEETA", "HUNGERSTATION"] as const;

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function displayStatus(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "نشط";
  if (value === "INACTIVE") return "غير نشط";
  if (value === "PENDING") return "قيد المراجعة";
  return value || "-";
}

function statusClass(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (value === "INACTIVE") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-800";
}

function cityName(project: Pick<ProjectRow, "city">) {
  return project.city?.nameAr || project.city?.nameEn || "-";
}

function projectContext(project: ProjectRow, params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  query.set("applicationProjectId", project.id);
  query.set("applicationId", project.applicationId);
  if (project.cityId) query.set("cityId", project.cityId);

  for (const key of ["month", "dateFrom", "dateTo", "status"]) {
    const value = one(params, key);
    if (value) query.set(key, value);
  }

  return query.toString();
}

function linkWithContext(path: string, project: ProjectRow, params: Record<string, string | string[] | undefined>) {
  return `${path}?${projectContext(project, params)}`;
}

function appKind(project: ProjectRow) {
  return normalize(project.application.code || project.application.name).includes("hunger") ? "HungerStation" : "Keeta";
}

async function getProjectsData() {
  const projects = await prisma.applicationProject.findMany({
    where: {
      cityId: { not: null },
      application: {
        code: { in: [...OPERATIONAL_APPLICATION_CODES] },
      },
    },
    include: {
      application: { select: { id: true, code: true, name: true, status: true } },
      city: { select: { id: true, nameAr: true, nameEn: true, status: true } },
      _count: {
        select: {
          accounts: true,
          importBatches: true,
          payrollRuns: true,
          invoices: true,
          dailyReports: true,
          importTemplates: true,
          invoiceSettings: true,
          rankSettings: true,
          payrollSettings: true,
          keetaRankRecords: true,
          keetaPerformanceRecords: true,
          keetaInvoiceRecords: true,
        },
      },
    },
    orderBy: [{ applicationId: "asc" }, { name: "asc" }],
  });

  const projectIds = projects.map((project) => project.id);

  const [accounts, supervisors, keetaRankRecords, keetaPerformanceRecords, keetaInvoiceRecords] = await Promise.all([
    prisma.applicationAccount.findMany({
      where: { applicationProjectId: { in: projectIds } },
      select: {
        id: true,
        applicationProjectId: true,
        appUserId: true,
        driverId: true,
        cityId: true,
        needsReview: true,
        unmatchedReason: true,
      },
    }),
    prisma.supervisor.findMany({
      where: { cityId: { not: null } },
      select: { cityId: true },
    }),
    prisma.keetaRankRecord.findMany({
      where: { applicationProjectId: { in: projectIds } },
      select: { applicationProjectId: true, courierId: true, driverId: true, month: true },
    }),
    prisma.keetaPerformanceRecord.findMany({
      where: { applicationProjectId: { in: projectIds } },
      select: { applicationProjectId: true, courierId: true, driverId: true, month: true },
    }),
    prisma.keetaInvoiceRecord.findMany({
      where: { applicationProjectId: { in: projectIds } },
      select: { applicationProjectId: true, courierId: true, driverId: true, month: true },
    }),
  ]);

  const accountAlerts = new Map<string, number>();
  const accountDrivers = new Map<string, Set<string>>();
  const supervisorCounts = new Map<string, number>();
  const sourceMovementGroups = new Map<string, Set<string>>();

  for (const account of accounts) {
    if (!account.applicationProjectId) continue;
    if (account.needsReview || !account.driverId || !account.cityId || account.unmatchedReason) {
      accountAlerts.set(account.applicationProjectId, (accountAlerts.get(account.applicationProjectId) ?? 0) + 1);
    }

    if (account.appUserId) {
      const key = `${account.applicationProjectId}:${account.appUserId}`;
      const current = accountDrivers.get(key) ?? new Set<string>();
      current.add(account.driverId || "missing-driver");
      accountDrivers.set(key, current);
    }
  }

  for (const supervisor of supervisors) {
    if (!supervisor.cityId) continue;
    supervisorCounts.set(supervisor.cityId, (supervisorCounts.get(supervisor.cityId) ?? 0) + 1);
  }

  for (const [accountKey, drivers] of accountDrivers) {
    if (drivers.size > 1) {
      const projectId = accountKey.split(":")[0] ?? "";
      accountAlerts.set(projectId, (accountAlerts.get(projectId) ?? 0) + 1);
    }
  }

  for (const record of [...keetaRankRecords, ...keetaPerformanceRecords, ...keetaInvoiceRecords]) {
    if (!record.applicationProjectId || !record.courierId) continue;
    const key = `${record.applicationProjectId}:${record.month || "no-month"}:${record.courierId}`;
    const drivers = sourceMovementGroups.get(key) ?? new Set<string>();
    drivers.add(record.driverId || "missing-driver");
    sourceMovementGroups.set(key, drivers);
  }

  for (const [sourceKey, drivers] of sourceMovementGroups) {
    if (drivers.size > 1) {
      const projectId = sourceKey.split(":")[0] ?? "";
      accountAlerts.set(projectId, (accountAlerts.get(projectId) ?? 0) + 1);
    }
  }

  const enriched = projects
    .map((project) => ({
      ...project,
      accountAlerts: accountAlerts.get(project.id) ?? 0,
      supervisorsCount: project.cityId ? supervisorCounts.get(project.cityId) ?? 0 : 0,
    }))
    .sort((a, b) => {
      const app = appKind(a).localeCompare(appKind(b));
      if (app) return app;
      return cityName(a).localeCompare(cityName(b), "ar");
    });

  return {
    projects: enriched,
    applications: [...new Map(enriched.map((project) => [project.application.id, project.application])).values()],
    cities: [...new Map(enriched.map((project) => [project.city!.id, project.city!])).values()].sort((a, b) =>
      (a.nameAr || a.nameEn || "").localeCompare(b.nameAr || b.nameEn || "", "ar"),
    ),
  };
}

function groupProjects(projects: ProjectRow[]) {
  const groups = new Map<string, { application: ProjectRow["application"]; projects: ProjectRow[] }>();
  for (const project of projects) {
    const current = groups.get(project.application.id) ?? { application: project.application, projects: [] };
    current.projects.push(project);
    groups.set(project.application.id, current);
  }
  return [...groups.values()].sort((a, b) => a.application.name.localeCompare(b.application.name));
}

function filterProjects(projects: ProjectRow[], params: Record<string, string | string[] | undefined>) {
  const q = normalize(one(params, "q"));
  const applicationId = one(params, "applicationId");
  const applicationShortcut = normalize(one(params, "application") || one(params, "applicationCode"));
  const cityId = one(params, "cityId");
  const status = one(params, "status");

  return projects.filter((project) => {
    const text = normalize(`${project.name} ${project.code} ${project.application.name} ${project.application.code} ${cityName(project)}`);
    if (q && !text.includes(q)) return false;
    if (applicationId && project.applicationId !== applicationId) return false;
    if (applicationShortcut && !normalize(`${project.application.name} ${project.application.code}`).includes(applicationShortcut)) return false;
    if (cityId && project.cityId !== cityId) return false;
    if (status && String(project.status).toUpperCase() !== status.toUpperCase()) return false;
    return true;
  });
}

function numberCard(label: string, value: string | number, tone = "slate") {
  const tones: Record<string, string> = {
    slate: "text-slate-950",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    blue: "text-blue-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <strong className={`mt-2 block text-3xl font-black ${tones[tone] ?? tones.slate}`}>{value}</strong>
    </div>
  );
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getProjectsData()
    .then((result) => ({ ...result, offline: "" }))
    .catch((error: unknown) => ({
      projects: [] as ProjectRow[],
      applications: [],
      cities: [],
      offline: error instanceof Error ? error.message : "database-offline",
    }));

  const projects = filterProjects(data.projects, params);
  const groups = groupProjects(projects);
  const totals = projects.reduce(
    (acc, project) => {
      acc.accounts += project._count.accounts;
      acc.imports += project._count.importBatches;
      acc.payrolls += project._count.payrollRuns;
      acc.invoices += project._count.invoices + project._count.keetaInvoiceRecords;
      acc.reports += project._count.dailyReports + project._count.keetaPerformanceRecords;
      acc.alerts += project.accountAlerts;
      return acc;
    },
    { accounts: 0, imports: 0, payrolls: 0, invoices: 0, reports: 0, alerts: 0 },
  );

  return (
    <PageShell
      title="المشاريع"
      description="الخريطة الموحدة لمشاريع التشغيل: التطبيق ثم المدينة. هذه الصفحة لا تعرض legacy project ولا Workspace عام بدون مدينة."
      actions={
        <>
          <Link href="/settings/application-account-review" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 shadow-sm">
            مراجعة ربط الحسابات
          </Link>
          <Link href="/account-movement" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 shadow-sm">
            حركة الحسابات
          </Link>
        </>
      }
    >
      {data.offline ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">
          قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">خريطة المشاريع حسب التطبيق والمدينة</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Keeta و HungerStation فقط، وكل مدينة لها ApplicationProject مستقل. الاستيراد والفواتير والمسير والتقارير تفتح دائمًا من صف مشروع المدينة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/projects?showEnsure=1" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
              تحديث مشاريع المدن
            </Link>
            <Link href="/settings/templates" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
              إعدادات القوالب
            </Link>
          </div>
        </div>

        {one(params, "showEnsure") ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            تم تجهيز سكربت آمن لإنشاء/مزامنة مشاريع المدن المعتمدة فقط بدون حذف بيانات. التقرير محفوظ في
            <span className="mx-1 font-mono">apps/erp/CITY_PROJECTS_CLEANUP_REPORT.md</span>
            ويمكن إعادة تشغيله من داخل app عبر:
            <span className="mx-1 font-mono">npm run ensure:city-projects</span>
          </div>
        ) : null}

        <form className="mt-4 grid gap-3 lg:grid-cols-6">
          <label className="grid gap-1 text-xs font-black text-slate-600 lg:col-span-2">
            بحث
            <input name="q" defaultValue={one(params, "q")} placeholder="اسم التطبيق / المدينة / كود المشروع" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            التطبيق
            <select name="applicationId" defaultValue={one(params, "applicationId")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">كل التطبيقات</option>
              {data.applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            المدينة
            <select name="cityId" defaultValue={one(params, "cityId")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">كل المدن</option>
              {data.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.nameAr || city.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            الحالة
            <select name="status" defaultValue={one(params, "status")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">كل الحالات</option>
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">غير نشط</option>
              <option value="PENDING">قيد المراجعة</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">
              تطبيق
            </button>
            <Link href="/projects" className="grid h-10 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              عرض الكل
            </Link>
          </div>
        </form>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        {numberCard("التطبيقات التشغيلية", groups.length)}
        {numberCard("مشاريع المدن", projects.length, "blue")}
        {numberCard("حسابات التطبيقات", totals.accounts, "emerald")}
        {numberCard("تنبيهات الربط والحركة", totals.alerts, totals.alerts ? "amber" : "emerald")}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {numberCard("عمليات الاستيراد", totals.imports)}
        {numberCard("الفواتير / Keeta Invoice", totals.invoices, "amber")}
        {numberCard("التقارير اليومية", totals.reports, "blue")}
        {numberCard("المسيرات", totals.payrolls, "emerald")}
      </div>

      <section className="space-y-4">
        {groups.map((group) => {
          const counts = group.projects.reduce(
            (acc, project) => {
              acc.accounts += project._count.accounts;
              acc.alerts += project.accountAlerts;
              acc.imports += project._count.importBatches;
              acc.invoices += project._count.invoices + project._count.keetaInvoiceRecords;
              acc.reports += project._count.dailyReports + project._count.keetaPerformanceRecords;
              acc.payrolls += project._count.payrollRuns;
              return acc;
            },
            { accounts: 0, alerts: 0, imports: 0, invoices: 0, reports: 0, payrolls: 0 },
          );

          return (
            <div key={group.application.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{group.application.name}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {group.projects.length} مشروع مدينة مستقل. القوالب مشتركة على مستوى التطبيق، والبيانات التشغيلية مفصولة حسب المدينة.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600 lg:grid-cols-6">
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-slate-950">{counts.accounts}</b>حسابات</span>
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-amber-700">{counts.alerts}</b>تنبيهات</span>
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-slate-950">{counts.imports}</b>استيراد</span>
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-slate-950">{counts.invoices}</b>فواتير</span>
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-slate-950">{counts.reports}</b>تقارير</span>
                    <span className="rounded-xl bg-white px-3 py-2"><b className="block text-base text-slate-950">{counts.payrolls}</b>مسيرات</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] text-right text-sm">
                  <thead className="bg-white text-xs font-black text-slate-500">
                    <tr>
                      {[
                        "مشروع المدينة",
                        "المدينة",
                        "كود المشروع",
                        "الحسابات",
                        "المشرفين",
                        "الاستيراد",
                        "الفواتير",
                        "التقارير",
                        "المسيرات",
                        "تنبيهات الربط",
                        "الحالة",
                        "الإجراءات",
                      ].map((head) => (
                        <th key={head} className="whitespace-nowrap px-4 py-3">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.projects.map((project) => {
                      const query = projectContext(project, params);
                      return (
                        <tr key={project.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <strong className="block text-slate-950">{project.name}</strong>
                            <span className="text-xs font-bold text-slate-500">{project.application.name}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{cityName(project)}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{project.code}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project._count.accounts}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project.supervisorsCount}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project._count.importBatches}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project._count.invoices + project._count.keetaInvoiceRecords}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project._count.dailyReports + project._count.keetaPerformanceRecords}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-black">{project._count.payrollRuns}</td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <Link
                              href={`/settings/application-account-review?${query}`}
                              className={`rounded-full px-2 py-1 text-xs font-black ${project.accountAlerts ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                            >
                              {project.accountAlerts ? `${project.accountAlerts} تحتاج مراجعة` : "سليم"}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className={`rounded-full px-2 py-1 text-xs font-black ${statusClass(project.status)}`}>{displayStatus(project.status)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-[520px] flex-wrap gap-2">
                              <Link href={linkWithContext(`/projects/${project.id}/dashboard`, project, params)} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white">
                                لوحة المشروع
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/imports`, project, params)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
                                الاستيراد
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/drivers`, project, params)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                                المناديب
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/accounts`, project, params)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                                الحسابات
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/invoices`, project, params)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                                الفواتير
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/payroll`, project, params)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                                المسير
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/reports`, project, params)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                                التقارير
                              </Link>
                              <Link href={`/account-movement?${query}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800">
                                حركة الحسابات
                              </Link>
                              <Link href={linkWithContext(`/projects/${project.id}/settings`, project, params)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                                الإعدادات
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {!groups.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
            لا توجد مشاريع تشغيل مطابقة للفلاتر الحالية.
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
