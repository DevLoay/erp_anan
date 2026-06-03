"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { DailyReportsOldData } from "@/lib/daily-reports/getDailyReportsOldPageData";

type Props = {
  data: DailyReportsOldData;
};

type ReportRow = DailyReportsOldData["rows"][number];

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[100] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
      {message}
      <button type="button" onClick={onClose} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">
        إغلاق
      </button>
    </div>
  );
}

function HeaderAction({ children, tone = "white", onClick }: { children: ReactNode; tone?: "white" | "blue" | "green" | "amber" | "red"; onClick: () => void }) {
  const klass = {
    white: "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  }[tone];

  return (
    <button type="button" onClick={onClick} className={`h-10 rounded-xl border px-4 text-sm font-black shadow-sm ${klass}`}>
      {children}
    </button>
  );
}

function SummaryCard({ title, value, sub, tone = "slate" }: { title: string; value: string | number; sub?: string; tone?: "slate" | "blue" | "emerald" | "amber" | "red" }) {
  const color = {
    slate: "text-slate-950",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className={`mt-1 block text-2xl font-black ${color}`}>{value}</strong>
      {sub ? <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p> : null}
    </div>
  );
}

function RateBadge({ value, type = "positive" }: { value: number; type?: "positive" | "zero-good" }) {
  const good = type === "zero-good" ? value === 0 : value >= 95;
  const amber = type === "positive" && value >= 80 && value < 95;
  const klass = good ? "bg-emerald-100 text-emerald-800" : amber ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${klass}`}>{pct(value)}</span>;
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "red" }) {
  const klass = tone === "green" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${klass}`}>{label}</span>;
}

function WarningBadges({ warnings }: { warnings: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {warnings.map((warning) => {
        const normal = warning === "طبيعي";
        const klass = normal ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
        return (
          <span key={warning} className={`rounded-full px-2 py-1 text-xs font-black ${klass}`}>
            {warning}
          </span>
        );
      })}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm font-bold text-slate-500">{body}</p>
    </div>
  );
}

function DetailModal({ row, onClose, onAction }: { row: ReportRow; onClose: () => void; onAction: (message: string) => void }) {
  const details = [
    ["التاريخ", row.reportDate],
    ["المندوب", row.driverName],
    ["كود المندوب", row.driverCode],
    ["الإقامة", row.nationalId],
    ["الجوال", row.phone],
    ["المدينة", row.city],
    ["المشروع", row.project],
    ["التطبيق", row.appName],
    ["الحساب", row.account],
    ["المشرف", row.supervisor],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">تقرير المندوب اليومي</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.driverName} - {row.reportDate}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
            إغلاق
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <SummaryCard title="الطلبات" value={fmt(row.orders)} tone="blue" />
          <SummaryCard title="ساعات العمل" value={row.workingHours} tone={row.workingHours >= 10 ? "emerald" : row.workingHours >= 8 ? "amber" : "red"} />
          <SummaryCard title="On-Time" value={pct(row.onTimeRate)} tone={row.onTimeRate >= 95 ? "emerald" : "red"} />
          <SummaryCard title="Cancellation" value={pct(row.cancellationRate)} tone={row.cancellationRate === 0 ? "emerald" : "red"} />
          <SummaryCard title="Rejection" value={pct(row.rejectionRate)} tone={row.rejectionRate === 0 ? "emerald" : "red"} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <strong className="mt-1 block text-sm font-black text-slate-950">{value || "-"}</strong>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-black text-slate-950">تنبيهات الأداء</h3>
          <div className="mt-3">
            <WarningBadges warnings={row.warnings} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/rider-kpi?driverId=${encodeURIComponent(row.driverId)}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">
            KPI المندوب
          </Link>
          <Link href={`/rider-reports?driverId=${encodeURIComponent(row.driverId)}&dateFrom=${encodeURIComponent(row.reportDate)}&dateTo=${encodeURIComponent(row.reportDate)}&appName=${encodeURIComponent(row.appName)}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
            تقرير المندوب
          </Link>
          <button type="button" onClick={() => onAction("CREATE_SUPERVISOR_TASK")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
            إنشاء مهمة
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(rows: ReportRow[]) {
  const header = ["التاريخ", "المندوب", "كود المندوب", "المدينة", "المشروع", "التطبيق", "الحساب", "الطلبات", "ساعات العمل", "On-Time", "Cancellation", "Rejection", "الحالة"];
  const lines = rows.map((row) =>
    [row.reportDate, row.driverName, row.driverCode, row.city, row.project, row.appName, row.account, row.orders, row.workingHours, row.onTimeRate, row.cancellationRate, row.rejectionRate, row.statusLabel]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily-reports.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function DailyReportsOldPageClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [pageSize, setPageSize] = useState(100);
  const rows = useMemo(() => data.rows, [data.rows]);
  const visibleRows = rows.slice(0, pageSize);

  async function createSupervisorTask(row: ReportRow) {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `متابعة تقرير ${row.driverName}`,
        description: `تنبيهات الأداء: ${row.warnings.join("، ")}. التاريخ: ${row.reportDate}. التطبيق: ${row.appName}.`,
        driverId: row.driverId || undefined,
        priority: row.statusTone === "red" ? "CRITICAL" : "INFO",
        status: "PENDING",
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(payload.error || "تعذر إنشاء المهمة.");
      return;
    }
    setToast("تم إنشاء مهمة للمشرف مرتبطة بالتقرير.");
  }

  if (data.databaseStatus === "offline") {
    return (
      <main className="w-full max-w-none bg-slate-50" dir="rtl">
        <EmptyState title="قاعدة البيانات غير متصلة" body={data.databaseMessage || "يرجى تشغيل PostgreSQL ثم تحديث الصفحة."} />
      </main>
    );
  }

  return (
    <main className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl" suppressHydrationWarning>
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {selected ? <DetailModal row={selected} onClose={() => setSelected(null)} onAction={() => createSupervisorTask(selected)} /> : null}

      <section className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <nav className="mb-1 flex items-center gap-2 text-xs font-black text-slate-500">
              <Link href="/">الرئيسية</Link>
              <span>/</span>
              <span>التقارير اليومية</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-950">التقارير اليومية</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">عرض تقارير التطبيقات اليومية حسب التاريخ والمشروع والمندوب مع آخر ملفات الاستيراد وحالات الربط.</p>
          </div>
          <button type="button" onClick={() => router.push("/reports")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xl font-black text-slate-800">
            ☰
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <HeaderAction onClick={() => window.print()}>طباعة / PDF</HeaderAction>
          <HeaderAction tone="amber" onClick={() => downloadCsv(rows)}>تصدير إكسل</HeaderAction>
          <HeaderAction tone="blue" onClick={() => router.push("/projects/keeta/imports?type=keeta_period_report_template")}>استيراد Excel / PDF</HeaderAction>
          <HeaderAction tone="green" onClick={() => router.push("/projects/keeta/imports?type=keeta_period_report_template&mode=manual")}>+ إضافة تقرير</HeaderAction>
          <Link href="/projects/keeta/imports?type=keeta_period_report_template" className="grid h-10 place-items-center rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-black text-white shadow-sm">
            رفع تقرير Keeta
          </Link>
          <Link href="/imports/history" className="grid h-10 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 shadow-sm">
            تاريخ الاستيراد
          </Link>
          <select aria-label="عدد الصفوف" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black shadow-sm">
            <option value={50}>50 صف</option>
            <option value={100}>100 صف</option>
            <option value={250}>250 صف</option>
            <option value={600}>600 صف</option>
          </select>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-9">
        <SummaryCard title="تقارير الفترة" value={fmt(data.summary.reportsCount)} tone="blue" />
        <SummaryCard title="طلبات الفترة" value={fmt(data.summary.totalOrders)} tone="blue" />
        <SummaryCard title="طلبات الشهر" value={fmt(data.summary.monthOrders)} />
        <SummaryCard title="مناديب نشطين" value={fmt(data.summary.activeDrivers)} />
        <SummaryCard title="متوسط الساعات" value={data.summary.avgWorkingHours} tone={data.summary.avgWorkingHours >= 10 ? "emerald" : data.summary.avgWorkingHours >= 8 ? "amber" : "red"} />
        <SummaryCard title="متوسط On-Time" value={pct(data.summary.avgOnTime)} tone={data.summary.avgOnTime >= 95 ? "emerald" : "red"} />
        <SummaryCard title="Cancellation" value={pct(data.summary.avgCancellation)} tone={data.summary.avgCancellation === 0 ? "emerald" : "red"} />
        <SummaryCard title="Rejection" value={pct(data.summary.avgRejection)} tone={data.summary.avgRejection === 0 ? "emerald" : "red"} />
        <SummaryCard title="آخر استيراد" value={data.summary.lastImport} sub={`${data.summary.uploadedReports} ملفات`} />
      </section>

      <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-9">
          <label htmlFor="daily-month" className="grid gap-1 text-xs font-black text-slate-800">
            الشهر
            <select id="daily-month" name="month" defaultValue={data.filters.month} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              {data.options.months.map((month) => (
                <option key={month} value={month}>
                  {month === data.filters.month ? data.filters.monthLabel : month}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="daily-from" className="grid gap-1 text-xs font-black text-slate-800">
            من تاريخ
            <input id="daily-from" name="fromDate" type="date" defaultValue={data.filters.fromDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="daily-to" className="grid gap-1 text-xs font-black text-slate-800">
            إلى تاريخ
            <input id="daily-to" name="toDate" type="date" defaultValue={data.filters.toDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="daily-city" className="grid gap-1 text-xs font-black text-slate-800">
            المدينة
            <select id="daily-city" name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المدن</option>
              {data.options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label htmlFor="daily-project" className="grid gap-1 text-xs font-black text-slate-800">
            المشروع
            <select id="daily-project" name="projectId" defaultValue={data.filters.projectId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشاريع</option>
              {data.options.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}{project.appName ? ` - ${project.appName}` : ""}</option>
              ))}
            </select>
          </label>
          <label htmlFor="daily-app" className="grid gap-1 text-xs font-black text-slate-800">
            التطبيق
            <select id="daily-app" name="appName" defaultValue={data.filters.appName} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل التطبيقات</option>
              {data.options.appNames.map((appName) => <option key={appName} value={appName}>{appName}</option>)}
            </select>
          </label>
          <label htmlFor="daily-supervisor" className="grid gap-1 text-xs font-black text-slate-800">
            المشرف
            <select id="daily-supervisor" name="supervisorId" defaultValue={data.filters.supervisorId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشرفين</option>
              {data.options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
            </select>
          </label>
          <label htmlFor="daily-rider" className="grid gap-1 text-xs font-black text-slate-800">
            المندوب
            <select id="daily-rider" name="riderId" defaultValue={data.filters.riderId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المناديب</option>
              {data.options.riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name} - {rider.code}</option>)}
            </select>
          </label>
          <label htmlFor="daily-search" className="grid gap-1 text-xs font-black text-slate-800">
            بحث مندوب / ID / حساب
            <input id="daily-search" name="q" defaultValue={data.filters.q} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-8 text-sm font-black text-white shadow-sm">
            تطبيق
          </button>
          <Link href="/daily-reports" className="grid h-11 place-items-center rounded-xl border border-slate-200 bg-white px-8 text-sm font-black text-slate-800 shadow-sm">
            عرض الكل
          </Link>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-950">جدول التقارير اليومية</h2>
            <p className="text-sm font-bold text-slate-500">المشروع هنا من جدول المشاريع فقط، والمندوب له فلتر مستقل عشان ما يحصلش خلط بين الاثنين.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Rows: {rows.length} / المعروض: {visibleRows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-700">
              <tr>
                {["التاريخ", "المندوب", "كود المندوب", "المدينة", "المشروع", "التطبيق", "الحساب", "المشرف", "الطلبات", "الساعات", "ON-TIME", "إلغاء", "رفض", "الحالة", "تنبيهات", "إجراءات"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-3 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.reportDate}</td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <strong className="block text-slate-950">{row.driverName}</strong>
                    <span className="text-xs font-bold text-slate-500">{row.nationalId}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.driverCode}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.city}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.project}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.appName}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.account}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.supervisor}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-black">{fmt(row.orders)}</td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.workingHours >= 10 ? "bg-emerald-100 text-emerald-800" : row.workingHours >= 8 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                      {row.workingHours}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3"><RateBadge value={row.onTimeRate} /></td>
                  <td className="border-b border-slate-100 px-3 py-3"><RateBadge value={row.cancellationRate} type="zero-good" /></td>
                  <td className="border-b border-slate-100 px-3 py-3"><RateBadge value={row.rejectionRate} type="zero-good" /></td>
                  <td className="border-b border-slate-100 px-3 py-3"><StatusBadge label={row.statusLabel} tone={row.statusTone} /></td>
                  <td className="border-b border-slate-100 px-3 py-3"><WarningBadges warnings={row.warnings} /></td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setSelected(row)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900">
                        تفاصيل
                      </button>
                      <Link href={`/rider-kpi?driverId=${encodeURIComponent(row.driverId)}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                        KPI
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? <EmptyState title="لا توجد تقارير للفلاتر الحالية" body="غيّر التاريخ أو المشروع أو راجع تاريخ الاستيراد للتأكد من اعتماد الملف." /> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">آخر ملفات مرفوعة</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[720px] w-full text-right text-sm">
              <thead className="bg-slate-100 text-xs font-black text-slate-700">
                <tr>
                  {["الملف", "النوع", "التطبيق", "الشهر", "الصفوف", "الحالة", "تاريخ الرفع"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.uploadedReports.map((report) => (
                  <tr key={report.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{report.fileName}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{report.importType}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{report.appName}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{report.month}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-black">{fmt(report.rowsCount)}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{report.status}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{report.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.uploadedReports.length ? <EmptyState title="لا توجد ملفات مرفوعة" body="أي ملف يتم اعتماده من الاستيراد سيظهر هنا." /> : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">صفوف تحتاج ربط مندوب</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">هذه الصفوف من آخر عملية استيراد ولم تدخل التقارير اليومية لأنها غير مرتبطة بمندوب محفوظ.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[720px] w-full text-right text-sm">
              <thead className="bg-slate-100 text-xs font-black text-slate-700">
                <tr>
                  {["الصف", "اسم المندوب من الملف", "Courier ID", "نوع الخطأ", "الرسالة", "إجراءات"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.missingRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-black">{row.rowNumber}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.riderName}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.appUserId}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{row.errorType}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-xs font-bold text-slate-500">{row.errorMessage}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <button type="button" onClick={() => router.push("/imports/history")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900">
                        ربط بمندوب
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.missingRows.length ? <EmptyState title="لا توجد صفوف ناقصة الربط" body="آخر ملف تم اعتماده لا يحتوي على أخطاء ربط ظاهرة." /> : null}
        </div>
      </section>
    </main>
  );
}
