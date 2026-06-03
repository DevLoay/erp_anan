"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ReportFilterOptions, ReportFilters } from "@/lib/reporting";

type Tone = "green" | "amber" | "red" | "blue" | "slate";

export type ManagementReportRow = {
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
  warningRows: number;
  criticalRows: number;
  alertsCount: number;
  approvedInvoices: number;
  approvedPayrolls: number;
  projectRevenue: string;
  payrollCost: string;
  estimatedProfit: string;
};

type TopItem = {
  label: string;
  sub: string;
  value: string;
  tone: Tone;
};

type Props = {
  filters: ReportFilters;
  options: ReportFilterOptions;
  summary: Summary;
  rows: ManagementReportRow[];
  topCities: TopItem[];
  topProjects: TopItem[];
};

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value * 10) / 10);
}

function pct(value: number) {
  return `${fmt(value)}%`;
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function badgeClass(tone: Tone) {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return classes[tone];
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

function levelFromRow(row: ManagementReportRow) {
  if (row.achievement >= 100 && row.score >= 80) return "A";
  if (row.achievement >= 80 && row.score >= 65) return "B";
  return "Below B";
}

function statusLabel(row: ManagementReportRow) {
  if (row.status === "GOOD") return "طبيعي";
  if (row.status === "WARNING") return "تحذير";
  return "حرج";
}

function oldButtonClass(tone: "white" | "blue" | "orange" | "green" | "red" | "dark" = "white") {
  const classes = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    orange: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  };
  return `h-9 rounded-lg border px-4 text-xs font-black shadow-sm ${classes[tone]}`;
}

function ActionButton({ children, tone = "white", onClick }: { children: ReactNode; tone?: "white" | "blue" | "orange" | "green" | "red" | "dark"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={oldButtonClass(tone)}>
      {children}
    </button>
  );
}

function CompactStat({ title, value, tone = "slate", hint }: { title: string; value: string | number; tone?: Tone; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className={`mt-1 block text-2xl font-black ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "blue" ? "text-blue-700" : "text-slate-950"}`}>
        {value}
      </strong>
      {hint ? <p className="mt-1 text-[11px] font-bold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function WarningBadges({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-800">طبيعي</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {warnings.slice(0, 4).map((warning) => (
        <span key={warning} className={`rounded-full px-2 py-1 text-[11px] font-black ${badgeClass(warningTone(warning))}`}>
          {warning}
        </span>
      ))}
      {warnings.length > 4 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">+{warnings.length - 4}</span> : null}
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <strong className={`block text-base font-black ${tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "blue" ? "text-blue-700" : "text-slate-950"}`}>{value}</strong>
    </div>
  );
}

function dailyWarningText(warnings: string[]) {
  return warnings.length ? warnings.join(" + ") : "-";
}

export function ManagementReportsOldClient({ filters, options, summary, rows }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ManagementReportRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(100);
  const [manualLevel, setManualLevel] = useState("Level C");
  const [orderLevel, setOrderLevel] = useState("Auto");
  const [notice, setNotice] = useState("");

  const warningRows = useMemo(() => rows.filter((row) => row.reasons.length || row.status !== "GOOD"), [rows]);
  const visibleRows = rows.slice(0, pageSize);
  const selectedCount = selectedIds.size;

  function showNotice(message: string) {
    setNotice(message);
  }

  function toggleRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleVisibleRows() {
    const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.driverId || `${row.driverName}:${row.appName}`));
    if (allVisibleSelected) {
      const next = new Set(selectedIds);
      visibleRows.forEach((row) => next.delete(row.driverId || `${row.driverName}:${row.appName}`));
      setSelectedIds(next);
      return;
    }
    setSelectedIds(new Set([...selectedIds, ...visibleRows.map((row) => row.driverId || `${row.driverName}:${row.appName}`)]));
  }

  function exportCsv() {
    const headers = ["المندوب", "الكود", "المدينة", "المشروع", "التطبيق", "المشرف", "الطلبات", "الساعات", "أيام العمل", "On-Time", "إلغاء", "رفض", "KPI", "الحالة", "التحذيرات"];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.driverName,
          row.driverCode,
          row.cityName,
          row.projectName,
          row.appName,
          row.supervisorName,
          row.orders,
          row.workingHours,
          row.activeDays,
          row.onTimeRate,
          row.cancellationRate,
          row.rejectionRate,
          row.score,
          statusLabel(row),
          row.reasons.join(" | "),
        ].map(csvEscape).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `general-reports-${filters.dateFrom}-${filters.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function reportUrl(row: ManagementReportRow) {
    const params = new URLSearchParams();
    params.set("driverId", row.driverId);
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
    if (row.appName) params.set("appName", row.appName);
    return `/rider-reports?${params.toString()}`;
  }

  function openSelectedReport() {
    if (!selectedIds.size) {
      showNotice("اختر مندوبًا من الجدول أولًا.");
      return;
    }
    const first = rows.find((row) => selectedIds.has(row.driverId || `${row.driverName}:${row.appName}`));
    if (first) setSelected(first);
  }

  function saveLevelViewOnly() {
    if (!selected?.driverId) {
      showNotice("افتح تقرير مندوب محدد أولًا ثم اربط المستوى بالمسير.");
      return;
    }
    router.push(`/payroll?driverId=${encodeURIComponent(selected.driverId)}&month=${encodeURIComponent(filters.month)}`);
  }

  return (
    <main className="w-full max-w-none space-y-3 bg-slate-50 p-4" dir="rtl">
      {notice ? (
        <div className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            إغلاق
          </button>
        </div>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="green" onClick={() => router.push(`/projects/keeta/imports?dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}`)}>+ إضافة</ActionButton>
            <ActionButton tone="blue" onClick={() => router.push("/imports")}>استيراد Excel / PDF</ActionButton>
            <ActionButton onClick={openSelectedReport}>تعديل</ActionButton>
            <ActionButton tone="red" onClick={() => (selectedCount ? router.push("/data-cleaning") : showNotice("اختر سجلًا أولًا."))}>حذف</ActionButton>
            <ActionButton tone="orange" onClick={exportCsv}>تصدير إكسل</ActionButton>
            <ActionButton onClick={() => window.print()}>طباعة / بي دي إف</ActionButton>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label htmlFor="top-from" className="grid gap-1 text-xs font-black text-slate-800">
              من تاريخ
              <input id="top-from" form="management-report-filters" name="dateFrom" type="date" defaultValue={filters.dateFrom} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
            </label>
            <label htmlFor="top-to" className="grid gap-1 text-xs font-black text-slate-800">
              إلى تاريخ
              <input id="top-to" form="management-report-filters" name="dateTo" type="date" defaultValue={filters.dateTo} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
            </label>
          </div>
        </div>
      </section>

      <section className="text-right">
        <h1 className="text-3xl font-black text-slate-950">التقارير العامة</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">تقارير عامة بإشارات وتحذيرات تشغيلية مرتبطة بالمناديب والمدن والمشاريع.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <CompactStat title="إجمالي المناديب" value={fmt(summary.totalRiders)} />
        <CompactStat title="إجمالي الطلبات" value={fmt(summary.totalOrders)} tone="blue" />
        <CompactStat title="متوسط KPI" value={pct(summary.avgKpi)} tone={kpiTone(summary.avgKpi)} />
        <CompactStat title="غير مؤهلين" value={fmt(summary.invalidRiders)} tone={summary.invalidRiders ? "red" : "green"} />
        <CompactStat title="تحذيرات" value={fmt(summary.alertsCount)} tone={summary.alertsCount ? "amber" : "green"} />
        <CompactStat title="إيراد المشاريع" value={summary.projectRevenue} tone="green" />
        <CompactStat title="الربح التقديري" value={summary.estimatedProfit} tone={summary.estimatedProfit.includes("-") ? "red" : "green"} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => window.print()}>طباعة / بي دي إف</ActionButton>
          <ActionButton tone="blue" onClick={exportCsv}>تصدير إكسل</ActionButton>
          <ActionButton tone="orange" onClick={() => router.push(`/notifications?fromDate=${filters.dateFrom}&toDate=${filters.dateTo}`)}>التنبيهات</ActionButton>
          <ActionButton tone="blue" onClick={() => router.push(`/city-ranking?month=${filters.month}&cityId=${filters.cityId}&projectId=${filters.projectId}`)}>تاريخ المدن</ActionButton>
          <select aria-label="عدد الصفوف" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black shadow-sm">
            <option value={25}>25 صف</option>
            <option value={50}>50 صف</option>
            <option value={100}>100 صف</option>
            <option value={250}>250 صف</option>
          </select>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          الفترة: {filters.dateFrom} إلى {filters.dateTo}
        </span>
      </section>

      <form id="management-report-filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input type="hidden" name="month" value={filters.month} />
          <label htmlFor="management-search" className="grid gap-1 text-xs font-black text-slate-800 xl:col-span-2">
            بحث بالاسم / الهوية / الكود / الحساب
            <input id="management-search" name="q" defaultValue={filters.q} placeholder="بحث..." className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label htmlFor="management-city" className="grid gap-1 text-xs font-black text-slate-800">
            المدينة
            <select id="management-city" name="cityId" defaultValue={filters.cityId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المدن</option>
              {options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label htmlFor="management-project" className="grid gap-1 text-xs font-black text-slate-800">
            المشروع
            <select id="management-project" name="projectId" defaultValue={filters.projectId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشاريع</option>
              {options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.appName ? ` - ${project.appName}` : ""}</option>)}
            </select>
          </label>
          <label htmlFor="management-app" className="grid gap-1 text-xs font-black text-slate-800">
            التطبيق
            <select id="management-app" name="appName" defaultValue={filters.appName} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل التطبيقات</option>
              {options.appNames.map((appName) => <option key={appName} value={appName}>{appName}</option>)}
            </select>
          </label>
          <label htmlFor="management-supervisor" className="grid gap-1 text-xs font-black text-slate-800">
            المشرف
            <select id="management-supervisor" name="supervisorId" defaultValue={filters.supervisorId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشرفين</option>
              {options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
            </select>
          </label>
          <label htmlFor="management-status" className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select id="management-status" name="status" defaultValue={filters.status} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
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
          <Link href="/management-reports" className="grid h-9 place-items-center rounded-lg border border-slate-200 bg-white px-8 text-xs font-black text-slate-800 shadow-sm">
            عرض الكل
          </Link>
          <span className="grid h-9 place-items-center rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600">
            عدد السجلات: {rows.length} / المعروض: {visibleRows.length}
          </span>
        </div>
      </form>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-base">التنبيهات والتحذيرات</strong>
          <span>{fmt(warningRows.length)} مندوب يحتاج متابعة داخل الفترة</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {warningRows.slice(0, 12).map((row) => (
            <button key={row.driverId || `${row.driverName}:${row.appName}`} type="button" onClick={() => setSelected(row)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-900 shadow-sm">
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
                <th className="border-b border-slate-200 px-3 py-3">
                  <input aria-label="اختيار المعروض" type="checkbox" onChange={toggleVisibleRows} checked={visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.driverId || `${row.driverName}:${row.appName}`))} />
                </th>
                {["المندوب", "المدينة", "التطبيق", "المشروع", "المشرف", "الطلبات", "الساعات", "أيام العمل", "ON-TIME", "إلغاء / رفض", "KPI", "الحالة", "التحذيرات", "إجراءات"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-3 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const id = row.driverId || `${row.driverName}:${row.appName}`;
                return (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-3">
                      <input aria-label={`اختيار ${row.driverName}`} type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleRow(id)} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <strong className="block text-slate-950">{row.driverName}</strong>
                      <span className="text-xs font-bold text-slate-500">{row.driverCode} {row.phone && row.phone !== "-" ? `· ${row.phone}` : ""}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.cityName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.appName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.projectName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.supervisorName}</td>
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
                        {row.driverId ? <Link href={reportUrl(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">تقرير المندوب</Link> : null}
                        <Link href={`/notifications?driverId=${encodeURIComponent(row.driverId)}&fromDate=${filters.dateFrom}&toDate=${filters.dateTo}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">تنبيه</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!rows.length ? (
          <div className="m-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h3 className="text-lg font-black text-slate-950">لا توجد بيانات حسب الفلاتر الحالية</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">غيّر التاريخ أو المدينة أو المشروع، أو تأكد من اعتماد تقارير المشروع قبل ظهورها هنا.</p>
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

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-[11px] font-black text-slate-700">
                من
                <input type="date" defaultValue={filters.dateFrom} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold" />
              </label>
              <label className="grid gap-1 text-[11px] font-black text-slate-700">
                إلى
                <input type="date" defaultValue={filters.dateTo} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold" />
              </label>
              <button type="button" onClick={() => setSelected({ ...selected })} className={oldButtonClass("dark")}>تطبيق</button>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">مستوى الطلبات: {levelFromRow(selected)}</span>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-800">KPI: {pct(selected.score)}</span>
            </div>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black text-slate-950">تعديل لفل المندوب A / B / C</h3>
                  <p className="text-xs font-bold text-slate-500">مستوى العرض الحالي محسوب من الطلبات وKPI داخل الفترة.</p>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-1 text-[11px] font-black text-slate-700">
                    لفل المسير
                    <select value={manualLevel} onChange={(event) => setManualLevel(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black">
                      <option>Level A</option>
                      <option>Level B</option>
                      <option>Level C</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-[11px] font-black text-slate-700">
                    مستوى الطلبات
                    <select value={orderLevel} onChange={(event) => setOrderLevel(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black">
                      <option>Auto</option>
                      <option>A</option>
                      <option>B</option>
                      <option>Below B</option>
                    </select>
                  </label>
                  <button type="button" onClick={saveLevelViewOnly} className={`${oldButtonClass("green")} self-end`}>حفظ وربط بالمسير</button>
                </div>
              </div>
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-lg font-black text-slate-950">ملخص الفترة من {filters.dateFrom} إلى {filters.dateTo}</h3>
              <div className="grid gap-2 md:grid-cols-4">
                <MiniMetric label="عدد الأيام" value={selected.activeDays} />
                <MiniMetric label="عدد الطلبات" value={fmt(selected.orders)} />
                <MiniMetric label="متوسط الطلبات اليومية" value={selected.activeDays ? fmt(selected.orders / selected.activeDays) : 0} />
                <MiniMetric label="إجمالي الساعات" value={fmt(selected.workingHours)} />
                <MiniMetric label="On Time" value={pct(selected.onTimeRate)} tone={selected.onTimeRate >= selected.targetOnTime ? "green" : "amber"} />
                <MiniMetric label="الإلغاء" value={pct(selected.cancellationRate)} tone={selected.cancellationRate ? "red" : "green"} />
                <MiniMetric label="الرفض" value={pct(selected.rejectionRate)} tone={selected.rejectionRate ? "red" : "green"} />
                <MiniMetric label="KPI الحساب فقط" value={pct(selected.score)} tone={kpiTone(selected.score)} />
              </div>
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-lg font-black text-slate-950">ملخص الشهر الحالي</h3>
              <div className="grid gap-2 md:grid-cols-4">
                <MiniMetric label="طلبات الفترة" value={fmt(selected.orders)} />
                <MiniMetric label="أيام مسجلة" value={selected.activeDays} />
                <MiniMetric label="متوسط الطلبات اليومية" value={selected.activeDays ? fmt(selected.orders / selected.activeDays) : 0} />
                <MiniMetric label="ساعات الفترة" value={fmt(selected.workingHours)} />
              </div>
            </section>

            <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-black text-amber-950">التحذيرات</h3>
              <div className="mt-2 space-y-2">
                {selected.reasons.length ? selected.reasons.map((warning) => (
                  <div key={warning} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-900">
                    <span>{warning}</span>
                    <span>تنبيه</span>
                  </div>
                )) : <div className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">لا توجد تحذيرات داخل الفترة</div>}
              </div>
            </section>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-950">التقارير اليومية المسجلة</h3>
                <Link href={reportUrl(selected)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">فتح التقرير الكامل</Link>
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
                        <td className="border-b border-slate-100 px-2 py-2"><WarningBadges warnings={report.warnings.length ? report.warnings : []} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.dailyReports.length ? <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-500">لا توجد تقارير يومية لهذا المندوب داخل الفترة.</p> : null}
              </div>
            </section>

            <div className="mt-4 flex flex-wrap gap-2">
              {selected.driverId ? <Link href={reportUrl(selected)} className={oldButtonClass("blue")}>فتح تقرير المندوب</Link> : null}
              <Link href={`/notifications?driverId=${encodeURIComponent(selected.driverId)}&fromDate=${filters.dateFrom}&toDate=${filters.dateTo}`} className={oldButtonClass("orange")}>تنبيهات المندوب</Link>
              <button type="button" onClick={() => setSelected(null)} className={oldButtonClass("white")}>إغلاق</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
