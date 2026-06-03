import Link from "next/link";
import { ImportStepper } from "@/components/imports/ImportStepper";
import type { ProjectWorkspace } from "@/lib/projects/projectWorkspace";
import type { ImportTemplateRow } from "@/lib/imports/templates";

type OnlineWorkspace = Extract<ProjectWorkspace, { status: "online" }>;

function fmtDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function shortDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

export function ProjectStateCard({ data }: { data: ProjectWorkspace }) {
  if (data.status === "offline") {
    return (
      <main className="w-full max-w-none bg-slate-50 p-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-black">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold">{data.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-none bg-slate-50 p-4" dir="rtl">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h1 className="text-2xl font-black">تعذر فتح المشروع</h1>
        <p className="mt-2 text-sm font-bold">{data.message}</p>
        <Link href="/projects" className="mt-4 inline-flex rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
          رجوع للمشاريع
        </Link>
      </div>
    </main>
  );
}

function Header({ data, active }: { data: OnlineWorkspace; active: string }) {
  const project = data.project;
  const projectRoute = project.routeId || project.id;
  const tabs = [
    ["dashboard", "لوحة المشروع", `/projects/${projectRoute}/dashboard`],
    ["imports", "الاستيراد", `/projects/${projectRoute}/imports`],
    ["invoices", "الفواتير", `/projects/${projectRoute}/invoices`],
    ["payroll", "المسير", `/projects/${projectRoute}/payroll`],
    ["reports", "التقارير", `/projects/${projectRoute}/reports`],
    ["settings", "الإعدادات", `/projects/${projectRoute}/settings`],
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/projects" className="hover:text-slate-950">المشاريع</Link>
            <span>/</span>
            <span className="text-slate-800">{project.name}</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">{project.name}</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            {project.applicationName} · {project.cityName} · كل عمليات الرفع والفواتير والمسير هنا مستقلة عن باقي المشاريع.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${projectRoute}/imports`} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-sm">استيراد تقرير</Link>
          <Link href={`/projects/${projectRoute}/invoices`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">الفواتير</Link>
          <Link href={`/projects/${projectRoute}/payroll`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800">المسير</Link>
          <Link href="/management-reports" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-800">التقارير العامة</Link>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([key, label, href]) => (
          <Link key={key} href={href} className={`rounded-xl px-4 py-2 text-xs font-black ${active === key ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-1 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function SummaryGrid({ data }: { data: OnlineWorkspace }) {
  const summary = data.summary;
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard title="إجمالي الطلبات" value={summary.totalOrdersText} tone="blue" />
      <StatCard title="المناديب" value={summary.driversCount} />
      <StatCard title="حسابات التطبيق" value={summary.accountsCount} />
      <StatCard title="حسابات غير مربوطة" value={summary.unlinkedAccounts} tone={summary.unlinkedAccounts ? "amber" : "emerald"} />
      <StatCard title="إيراد المشروع المعتمد" value={summary.approvedInvoiceTotal} tone="emerald" />
      <StatCard title="تكلفة رواتب المناديب" value={summary.approvedPayrollNet} tone="red" />
    </div>
  );
}

function Filters({ data, target }: { data: OnlineWorkspace; target: string }) {
  return (
    <form action={target} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
      <label className="grid gap-1 text-xs font-black text-slate-600">
        الشهر
        <input name="month" type="month" defaultValue={data.filters.month} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-black text-slate-600">
        المدينة
        <select name="cityId" defaultValue={data.filters.cityId} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option value="">كل المدن</option>
          {data.options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-black text-slate-600">
        المشرف
        <select name="supervisorId" defaultValue={data.filters.supervisorId} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option value="">كل المشرفين</option>
          {data.options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-black text-slate-600">
        من تاريخ
        <input name="dateFrom" type="date" defaultValue={data.filters.dateFrom} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <div className="flex items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs font-black text-slate-600">
          إلى تاريخ
          <input name="dateTo" type="date" defaultValue={data.filters.dateTo} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white">تطبيق</button>
      </div>
    </form>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">{text}</div>;
}

function RecentImports({ data }: { data: OnlineWorkspace }) {
  if (!data.imports.length) return <Empty text="لا توجد عمليات استيراد لهذا المشروع حتى الآن." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1000px] w-full text-right text-sm">
        <thead className="bg-slate-100 text-xs font-black text-slate-600">
          <tr>
            {["الملف", "النوع", "القالب", "الصفوف", "الصحيح", "الأخطاء", "Missing Drivers", "الحالة", "المستخدم", "التاريخ", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.imports.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-black">{item.fileName}</td>
              <td className="px-4 py-3">{item.fileType}</td>
              <td className="px-4 py-3">{item.templateName}</td>
              <td className="px-4 py-3">{item.totalRows}</td>
              <td className="px-4 py-3 text-emerald-700">{item.validRows}</td>
              <td className="px-4 py-3 text-red-700">{item.invalidRows}</td>
              <td className="px-4 py-3">{item.missingDrivers}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{item.status}</span></td>
              <td className="px-4 py-3">{item.createdBy}</td>
              <td className="px-4 py-3">{fmtDate(item.createdAt)}</td>
              <td className="px-4 py-3"><Link href={`/imports/history/${item.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">فتح</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTable({ data }: { data: OnlineWorkspace }) {
  if (!data.reports.length) return <Empty text="لا توجد تقارير يومية معتمدة أو محفوظة لهذا المشروع في الفترة المحددة." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1100px] w-full text-right text-sm">
        <thead className="bg-slate-100 text-xs font-black text-slate-600">
          <tr>
            {["التاريخ", "كود المندوب", "المندوب", "المدينة", "المشرف", "الطلبات", "الساعات", "On-Time", "Cancellation", "Rejection", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.reports.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.date}</td>
              <td className="px-4 py-3">{row.driverCode}</td>
              <td className="px-4 py-3 font-black">{row.driverName}</td>
              <td className="px-4 py-3">{row.cityName}</td>
              <td className="px-4 py-3">{row.supervisorName}</td>
              <td className="px-4 py-3 font-black">{row.orders}</td>
              <td className="px-4 py-3">{row.workingHours}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${row.onTimeRate >= 99 ? "bg-emerald-50 text-emerald-700" : row.onTimeRate >= 95 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{row.onTimeRate}%</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${row.cancellationRate > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{row.cancellationRate}%</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${row.rejectionRate > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{row.rejectionRate}%</span></td>
              <td className="px-4 py-3">
                {row.driverId ? (
                  <Link href={`/rider-reports?driverId=${encodeURIComponent(row.driverId)}&dateFrom=${encodeURIComponent(row.date)}&dateTo=${encodeURIComponent(row.date)}&appName=${encodeURIComponent(data.project.applicationName)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">تقرير</Link>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTable({ data }: { data: OnlineWorkspace }) {
  if (!data.invoices.length) return <Empty text="لا توجد فواتير محفوظة لهذا المشروع حتى الآن. ارفع فاتورة المشروع من صفحة الاستيراد الخاصة به." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[900px] w-full text-right text-sm">
        <thead className="bg-slate-100 text-xs font-black text-slate-600">
          <tr>
            {["رقم الفاتورة", "العميل", "الشهر", "القيمة", "VAT", "الحالة", "تاريخ الإصدار"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.invoices.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.number}</td>
              <td className="px-4 py-3">{row.client}</td>
              <td className="px-4 py-3">{row.month}</td>
              <td className="px-4 py-3">{row.amount}</td>
              <td className="px-4 py-3">{row.vatAmount}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{row.status}</span></td>
              <td className="px-4 py-3">{shortDate(row.issuedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayrollTable({ data }: { data: OnlineWorkspace }) {
  if (!data.payrollRuns.length) return <Empty text="لا توجد مسيرات لهذا المشروع في الفترة المحددة. المسير يتولد من الفواتير والتقارير المعتمدة وليس كرفع تشغيلي أساسي." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1000px] w-full text-right text-sm">
        <thead className="bg-slate-100 text-xs font-black text-slate-600">
          <tr>
            {["الشهر", "المدينة", "المناديب", "الطلبات", "إجمالي راتب المناديب", "الخصومات", "صافي راتب المناديب", "مستحق الشركة من كيتا", "الربح التقديري", "الحالة", "اعتماد"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.payrollRuns.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.month}</td>
              <td className="px-4 py-3">{row.cityName}</td>
              <td className="px-4 py-3">{row.totalDrivers}</td>
              <td className="px-4 py-3">{row.totalOrders}</td>
              <td className="px-4 py-3">{row.totalEarnings}</td>
              <td className="px-4 py-3">{row.totalDeductions}</td>
              <td className="px-4 py-3 font-black">{row.netTotal}</td>
              <td className="px-4 py-3 font-black text-blue-700">{row.totalCompanyRevenue}</td>
              <td className="px-4 py-3 font-black text-emerald-700">{row.estimatedCompanyProfit}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{row.status}</span></td>
              <td className="px-4 py-3">{row.approvedAt === "-" ? "-" : fmtDate(row.approvedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectDashboardView({ data }: { data: OnlineWorkspace }) {
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="dashboard" />
      <SummaryGrid data={data} />
      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard title="متوسط On-Time" value={`${data.summary.averageOnTime}%`} tone={data.summary.averageOnTime >= 99 ? "emerald" : data.summary.averageOnTime >= 95 ? "amber" : "red"} />
        <StatCard title="Cancellation" value={`${data.summary.averageCancellation}%`} tone={data.summary.averageCancellation > 0 ? "red" : "emerald"} />
        <StatCard title="Rejection" value={`${data.summary.averageRejection}%`} tone={data.summary.averageRejection > 0 ? "red" : "emerald"} />
        <StatCard title="صافي المشروع المعتمد" value={data.summary.netProfit} tone="emerald" />
      </div>
      <section className="space-y-3">
        <h2 className="text-xl font-black text-slate-950">آخر عمليات الاستيراد</h2>
        <RecentImports data={data} />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-black text-slate-950">آخر التقارير اليومية</h2>
        <ReportsTable data={data} />
      </section>
    </main>
  );
}

export function ProjectImportsView({
  data,
  templates,
  applications,
  projects,
  allowedTypes,
}: {
  data: OnlineWorkspace;
  templates: ImportTemplateRow[];
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  allowedTypes: string[];
}) {
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="imports" />
      <SummaryGrid data={data} />
      <ImportStepper
        templates={templates}
        applications={applications}
        projects={projects}
        cities={data.options.cities}
        allowedImportTypes={allowedTypes}
        lockedApplicationId={data.project.applicationId}
        lockedProjectId={data.project.id}
        lockedLegacyProjectId={data.project.legacyProjectId ?? undefined}
        lockedCityId={data.filters.cityId || data.project.cityId || undefined}
        scopeLabel={`${data.project.applicationName} / ${data.project.name}`}
      />
      <section className="space-y-3">
        <h2 className="text-xl font-black text-slate-950">تاريخ رفع ملفات المشروع</h2>
        <RecentImports data={data} />
      </section>
    </main>
  );
}

export function ProjectInvoicesView({ data }: { data: OnlineWorkspace }) {
  const projectRoute = data.project.routeId || data.project.id;
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="invoices" />
      <SummaryGrid data={data} />
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        الفواتير لا تدخل في حسابات المشروع إلا بعد الاعتماد. حالات التشغيل: Draft، Uploaded، Reviewed، Approved، Locked، Paid.
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/projects/${projectRoute}/imports`} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">رفع فاتورة المشروع</Link>
        <Link href={`/projects/${projectRoute}/reports`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black">تقرير المشروع</Link>
      </div>
      <InvoicesTable data={data} />
    </main>
  );
}

export function ProjectPayrollView({ data }: { data: OnlineWorkspace }) {
  const projectRoute = data.project.routeId || data.project.id;
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="payroll" />
      <SummaryGrid data={data} />
      <Filters data={data} target={`/projects/${projectRoute}/payroll`} />
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
        المسير يتولد من تقارير وفواتير المشروع المعتمدة، السلف، المخالفات، البنزين، إيجار السيارة، البونص والخصومات. رفع مسير قديم يستخدم فقط للمطابقة أو Migration.
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/payroll?projectId=${data.project.legacyProjectId ?? ""}&month=${data.filters.month}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">مراجعة / إنشاء مسير</Link>
        <Link href={`/payroll/settings?applicationProjectId=${data.project.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black">إعدادات المسير</Link>
      </div>
      <PayrollTable data={data} />
    </main>
  );
}

export function ProjectReportsView({ data }: { data: OnlineWorkspace }) {
  const projectRoute = data.project.routeId || data.project.id;
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="reports" />
      <SummaryGrid data={data} />
      <Filters data={data} target={`/projects/${projectRoute}/reports`} />
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
        هذه الصفحة تقرأ بيانات المشروع فقط. التقارير العامة في /management-reports تجمع البيانات المعتمدة بدون قبول أي رفع ملفات.
      </div>
      <ReportsTable data={data} />
    </main>
  );
}

export function ProjectSettingsView({ data }: { data: OnlineWorkspace }) {
  const appId = data.project.applicationId;
  const projectId = data.project.id;
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <Header data={data} active="settings" />
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="إعدادات الفاتورة" value={data.summary.invoiceSettingsCount} />
        <StatCard title="إعدادات الرانك" value={data.summary.rankSettingsCount} />
        <StatCard title="إعدادات المسير" value={data.summary.payrollSettingsCount} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href={`/applications/${appId}/projects/${projectId}/invoice-settings`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
          <h2 className="text-lg font-black text-slate-950">إعدادات الفاتورة</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">أعمدة الفاتورة، المطابقة، وقواعد الحساب الخاصة بالمشروع.</p>
        </Link>
        <Link href={`/applications/${appId}/projects/${projectId}/rank-settings`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
          <h2 className="text-lg font-black text-slate-950">إعدادات الرانك</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">قواعد Keeta Rank أو أي رانك خاص بالتطبيق.</p>
        </Link>
        <Link href={`/applications/${appId}/projects/${projectId}/payroll-settings`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
          <h2 className="text-lg font-black text-slate-950">إعدادات المسير</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">الراتب، التارجت، البونص، الخصومات، إيجار السيارة والمستويات.</p>
        </Link>
      </div>
    </main>
  );
}

