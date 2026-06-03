"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { ReportFilterOptions, ReportFilters } from "@/lib/reporting";

type Tone = "green" | "amber" | "red" | "blue" | "slate";

export type RiderReportRow = {
  driverId: string;
  driverCode: string;
  driverName: string;
  phone: string;
  cityName: string;
  projectName: string;
  appName: string;
  supervisorName: string;
  account: string;
  orders: number;
  workingHours: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  activeDays: number;
  achievement: number;
  score: number;
  status: "GOOD" | "WARNING" | "CRITICAL";
  valid: boolean;
  reasons: string[];
  targetOrders: number;
  targetHours: number;
  targetOnTime: number;
  dailyReports: {
    id: string;
    date: string;
    orders: number;
    workingHours: number;
    onTimeRate: number;
    cancellationRate: number;
    rejectionRate: number;
    warnings: string[];
  }[];
};

type Summary = {
  totalRiders: number;
  totalOrders: number;
  totalHours: number;
  avgOnTime: number;
  avgCancellation: number;
  avgRejection: number;
  avgKpi: number;
  validRiders: number;
  invalidRiders: number;
  alertsCount: number;
};

type Props = {
  filters: ReportFilters;
  options: ReportFilterOptions;
  summary: Summary;
  rows: RiderReportRow[];
};

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value * 10) / 10);
}

function pct(value: number) {
  return `${fmt(value)}%`;
}

function badgeClass(tone: Tone) {
  return {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
}

function kpiTone(value: number): Tone {
  if (value >= 80) return "green";
  if (value >= 55) return "amber";
  return "red";
}

function warningTone(text: string): Tone {
  if (text.includes("إلغاء") || text.includes("رفض") || text.includes("لا يوجد")) return "red";
  if (text.includes("On-Time") || text.includes("التارجت") || text.includes("ساعات")) return "amber";
  return "blue";
}

function level(row: RiderReportRow) {
  if (row.achievement >= 100 && row.score >= 80) return "A";
  if (row.achievement >= 80 && row.score >= 65) return "B";
  return "Below B";
}

function statusLabel(row: RiderReportRow) {
  if (row.status === "GOOD") return "طبيعي";
  if (row.status === "WARNING") return "تحذير";
  return "حرج";
}

function oldButtonClass(tone: "white" | "blue" | "orange" | "green" | "red" | "dark" = "white") {
  return `h-9 rounded-lg border px-4 text-xs font-black shadow-sm ${
    {
      white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
      blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
      orange: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
      green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
      red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
      dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
    }[tone]
  }`;
}

function ActionButton({ children, tone = "white", onClick }: { children: ReactNode; tone?: "white" | "blue" | "orange" | "green" | "red" | "dark"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={oldButtonClass(tone)}>
      {children}
    </button>
  );
}

function Stat({ title, value, tone = "slate", hint }: { title: string; value: string | number; tone?: Tone; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className={`mt-1 block text-2xl font-black ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "blue" ? "text-blue-700" : "text-slate-950"}`}>{value}</strong>
      {hint ? <p className="mt-1 text-[11px] font-bold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function WarningBadges({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-800">طبيعي</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {warnings.slice(0, 5).map((warning) => (
        <span key={warning} className={`rounded-full px-2 py-1 text-[11px] font-black ${badgeClass(warningTone(warning))}`}>
          {warning}
        </span>
      ))}
      {warnings.length > 5 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">+{warnings.length - 5}</span> : null}
    </div>
  );
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function hasSavedDriver(row: RiderReportRow) {
  return Boolean(row.driverId && !row.driverId.startsWith("unassigned:"));
}

export function RiderReportsOldClient({ filters, options, summary, rows }: Props) {
  const [selected, setSelected] = useState<RiderReportRow | null>(rows.length === 1 ? rows[0] : null);
  const [pageSize, setPageSize] = useState(100);
  const warningRows = useMemo(() => rows.filter((row) => row.reasons.length || row.status !== "GOOD"), [rows]);
  const visibleRows = rows.slice(0, pageSize);

  function exportCsv() {
    const headers = ["المندوب", "الكود", "المدينة", "المشروع", "التطبيق", "المشرف", "الطلبات", "الساعات", "أيام العمل", "On-Time", "إلغاء", "رفض", "KPI", "التحذيرات"];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [row.driverName, row.driverCode, row.cityName, row.projectName, row.appName, row.supervisorName, row.orders, row.workingHours, row.activeDays, row.onTimeRate, row.cancellationRate, row.rejectionRate, row.score, row.reasons.join(" | ")]
          .map(csvEscape)
          .join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rider-reports-${filters.dateFrom}-${filters.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="w-full max-w-none space-y-3 bg-slate-50 p-4" dir="rtl">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => window.print()}>طباعة / بي دي إف</ActionButton>
            <ActionButton tone="blue" onClick={exportCsv}>تصدير إكسل</ActionButton>
            <Link href="/daily-reports" className={oldButtonClass("blue")}>التقارير اليومية</Link>
            <Link href="/rider-kpi" className={oldButtonClass("green")}>عرض KPI المناديب</Link>
            <Link href="/management-reports" className={oldButtonClass("white")}>التقارير العامة</Link>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label htmlFor="top-from" className="grid gap-1 text-xs font-black text-slate-800">
              من تاريخ
              <input id="top-from" form="rider-report-filters" name="dateFrom" type="date" defaultValue={filters.dateFrom} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
            </label>
            <label htmlFor="top-to" className="grid gap-1 text-xs font-black text-slate-800">
              إلى تاريخ
              <input id="top-to" form="rider-report-filters" name="dateTo" type="date" defaultValue={filters.dateTo} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
            </label>
          </div>
        </div>
      </section>

      <section className="text-right">
        <h1 className="text-3xl font-black text-slate-950">تقارير المناديب</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">تقرير مندوب مجمع حسب الفترة، مع ربط يوميات الأداء والتحذيرات والحساب والمشرف.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <Stat title="إجمالي المناديب" value={fmt(summary.totalRiders)} />
        <Stat title="إجمالي الطلبات" value={fmt(summary.totalOrders)} tone="blue" />
        <Stat title="متوسط KPI" value={pct(summary.avgKpi)} tone={kpiTone(summary.avgKpi)} />
        <Stat title="مؤهلين" value={fmt(summary.validRiders)} tone="green" />
        <Stat title="غير مؤهلين" value={fmt(summary.invalidRiders)} tone={summary.invalidRiders ? "red" : "green"} />
        <Stat title="تحذيرات" value={fmt(summary.alertsCount)} tone={summary.alertsCount ? "amber" : "green"} />
        <Stat title="ساعات العمل" value={fmt(summary.totalHours)} />
      </section>

      <form id="rider-report-filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input type="hidden" name="month" value={filters.month} />
          <label htmlFor="rider-q" className="grid gap-1 text-xs font-black text-slate-800 xl:col-span-2">
            بحث مندوب / ID / حساب
            <input id="rider-q" name="q" defaultValue={filters.q} placeholder="بحث..." className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="rider-city" className="grid gap-1 text-xs font-black text-slate-800">
            المدينة
            <select id="rider-city" name="cityId" defaultValue={filters.cityId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المدن</option>
              {options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label htmlFor="rider-project" className="grid gap-1 text-xs font-black text-slate-800">
            المشروع
            <select id="rider-project" name="projectId" defaultValue={filters.projectId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشاريع</option>
              {options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.appName ? ` - ${project.appName}` : ""}</option>)}
            </select>
          </label>
          <label htmlFor="rider-app" className="grid gap-1 text-xs font-black text-slate-800">
            التطبيق
            <select id="rider-app" name="appName" defaultValue={filters.appName} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل التطبيقات</option>
              {options.appNames.map((appName) => <option key={appName} value={appName}>{appName}</option>)}
            </select>
          </label>
          <label htmlFor="rider-supervisor" className="grid gap-1 text-xs font-black text-slate-800">
            المشرف
            <select id="rider-supervisor" name="supervisorId" defaultValue={filters.supervisorId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشرفين</option>
              {options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
            </select>
          </label>
          <label htmlFor="rider-status" className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select id="rider-status" name="status" defaultValue={filters.status} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل الحالات</option>
              <option value="valid">مؤهل</option>
              <option value="invalid">غير مؤهل</option>
              <option value="GOOD">جيد</option>
              <option value="WARNING">تحذير</option>
              <option value="CRITICAL">حرج</option>
            </select>
          </label>
          <button type="submit" className={oldButtonClass("dark")}>تطبيق</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/rider-reports" className="grid h-9 place-items-center rounded-lg border border-slate-200 bg-white px-8 text-xs font-black text-slate-800 shadow-sm">عرض الكل</Link>
          <select aria-label="عدد الصفوف" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black shadow-sm">
            <option value={25}>25 صف</option>
            <option value={50}>50 صف</option>
            <option value={100}>100 صف</option>
            <option value={250}>250 صف</option>
          </select>
        </div>
      </form>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-base">التنبيهات والتحذيرات</strong>
          <span>{fmt(warningRows.length)} مندوب يحتاج متابعة</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {warningRows.slice(0, 12).map((row) => (
            <button key={row.driverId || row.driverName} type="button" onClick={() => setSelected(row)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-900 shadow-sm">
              {row.driverName}: {row.reasons[0] || statusLabel(row)}
            </button>
          ))}
          {!warningRows.length ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">لا توجد تحذيرات للفترة الحالية</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1550px] w-full text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-700">
              <tr>
                {["المندوب", "المدينة", "التطبيق", "المشروع", "المشرف", "الحساب", "الطلبات", "الساعات", "أيام العمل", "ON-TIME", "إلغاء / رفض", "KPI", "الحالة", "التحذيرات", "إجراءات"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-3 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.driverId || `${row.driverName}:${row.appName}`} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-3">
                    <strong className="block text-slate-950">{row.driverName}</strong>
                    <span className="text-xs font-bold text-slate-500">{row.driverCode} {row.phone && row.phone !== "-" ? `· ${row.phone}` : ""}</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.cityName}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.appName}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.projectName}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.supervisorName}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.account}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-black">{fmt(row.orders)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{fmt(row.workingHours)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{fmt(row.activeDays)}</td>
                  <td className="border-b border-slate-100 px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${badgeClass(row.onTimeRate >= row.targetOnTime ? "green" : "amber")}`}>{pct(row.onTimeRate)}</span></td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{pct(row.cancellationRate)} / {pct(row.rejectionRate)}</td>
                  <td className="border-b border-slate-100 px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${badgeClass(kpiTone(row.score))}`}>{pct(row.score)}</span></td>
                  <td className="border-b border-slate-100 px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${badgeClass(row.status === "GOOD" ? "green" : row.status === "WARNING" ? "amber" : "red")}`}>{statusLabel(row)}</span></td>
                  <td className="border-b border-slate-100 px-3 py-3"><WarningBadges warnings={row.reasons} /></td>
                  <td className="border-b border-slate-100 px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setSelected(row)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-900 shadow-sm">فتح التقرير</button>
                      {hasSavedDriver(row) ? <Link href={`/daily-reports?driverId=${encodeURIComponent(row.driverId)}&fromDate=${filters.dateFrom}&toDate=${filters.dateTo}&appName=${encodeURIComponent(row.appName)}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">اليوميات</Link> : null}
                      {hasSavedDriver(row) ? <Link href={`/drivers/${row.driverId}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">ملف المندوب</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <div className="m-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-lg font-black text-slate-950">لا توجد تقارير حسب الفلاتر الحالية</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">غيّر التاريخ أو المندوب أو المشروع، أو تأكد من اعتماد تقارير المشروع.</p>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">×</button>
              <div className="text-right">
                <h2 className="text-2xl font-black text-slate-950">تقرير المندوب - {selected.driverName}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{selected.supervisorName} · {selected.cityName} · {selected.appName}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <Stat title="Level" value={level(selected)} tone={kpiTone(selected.achievement)} />
              <Stat title="KPI" value={pct(selected.score)} tone={kpiTone(selected.score)} />
              <Stat title="الطلبات" value={fmt(selected.orders)} hint={`التارجت ${fmt(selected.targetOrders)}`} />
              <Stat title="الساعات" value={fmt(selected.workingHours)} hint={`المطلوب ${fmt(selected.targetHours)}`} />
              <Stat title="أيام العمل" value={fmt(selected.activeDays)} />
              <Stat title="On-Time" value={pct(selected.onTimeRate)} tone={selected.onTimeRate >= selected.targetOnTime ? "green" : "amber"} />
              <Stat title="الإلغاء" value={pct(selected.cancellationRate)} tone={selected.cancellationRate ? "red" : "green"} />
              <Stat title="الرفض" value={pct(selected.rejectionRate)} tone={selected.rejectionRate ? "red" : "green"} />
            </div>

            <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-black text-amber-950">التحذيرات</h3>
              <div className="mt-2"><WarningBadges warnings={selected.reasons} /></div>
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-950">التقارير اليومية المسجلة</h3>
                {hasSavedDriver(selected) ? <Link href={`/daily-reports?driverId=${encodeURIComponent(selected.driverId)}&fromDate=${filters.dateFrom}&toDate=${filters.dateTo}&appName=${encodeURIComponent(selected.appName)}`} className={oldButtonClass("green")}>فتح اليوميات</Link> : null}
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="min-w-[760px] w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {["التاريخ", "الطلبات", "الساعات", "ON TIME", "إلغاء", "رفض", "ملاحظات"].map((head) => (
                        <th key={head} className="border-b border-slate-200 px-2 py-2">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.dailyReports.map((report) => (
                      <tr key={report.id}>
                        <td className="border-b border-slate-100 px-2 py-2 font-bold">{report.date}</td>
                        <td className="border-b border-slate-100 px-2 py-2 font-black">{fmt(report.orders)}</td>
                        <td className="border-b border-slate-100 px-2 py-2">{fmt(report.workingHours)}</td>
                        <td className="border-b border-slate-100 px-2 py-2">{pct(report.onTimeRate)}</td>
                        <td className="border-b border-slate-100 px-2 py-2">{pct(report.cancellationRate)}</td>
                        <td className="border-b border-slate-100 px-2 py-2">{pct(report.rejectionRate)}</td>
                        <td className="border-b border-slate-100 px-2 py-2"><WarningBadges warnings={report.warnings} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.dailyReports.length ? <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-500">لا توجد تقارير يومية لهذا المندوب داخل الفترة.</p> : null}
              </div>
            </section>

            <div className="mt-4 flex flex-wrap gap-2">
              {hasSavedDriver(selected) ? <Link href={`/rider-kpi?driverId=${encodeURIComponent(selected.driverId)}`} className={oldButtonClass("blue")}>فتح KPI</Link> : null}
              {hasSavedDriver(selected) ? <Link href={`/drivers/${selected.driverId}`} className={oldButtonClass("green")}>ملف المندوب</Link> : null}
              <button type="button" onClick={() => setSelected(null)} className={oldButtonClass("white")}>إغلاق</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
