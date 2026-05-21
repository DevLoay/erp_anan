"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { NotificationRow, NotificationsData, NotificationSeverity } from "@/lib/notifications/getNotificationsData";

type Props = {
  data: NotificationsData;
};

type FilterValue = "all" | string;

const actionMessage = "هذه الميزة قيد التطوير";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: "red" | "amber" | "blue" | "emerald" }) {
  const classes = {
    red: "border-red-100 text-red-700",
    amber: "border-amber-100 text-amber-700",
    blue: "border-blue-100 text-blue-700",
    emerald: "border-emerald-100 text-emerald-700",
  };
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-2 block text-3xl font-black">{value}</strong>
    </div>
  );
}

function SeverityBadge({ severity, label }: { severity: NotificationSeverity; label: string }) {
  const classes = {
    CRITICAL: "bg-red-100 text-red-800",
    WARNING: "bg-amber-100 text-amber-800",
    INFO: "bg-blue-100 text-blue-800",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes[severity]}`}>{label}</span>;
}

function StatusBadge({ label }: { label: string }) {
  const done = label === "تم الحل";
  const ignored = label === "تم التجاهل" || label === "مغلق";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-emerald-100 text-emerald-800" : ignored ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-800"}`}>
      {label}
    </span>
  );
}

function ActionButton({ children, onClick, tone = "white" }: { children: ReactNode; onClick: () => void; tone?: "white" | "blue" | "green" | "red" | "amber" }) {
  const classes = {
    white: "border border-slate-200 bg-white text-slate-800",
    blue: "bg-blue-600 text-white",
    green: "bg-emerald-600 text-white",
    red: "bg-red-600 text-white",
    amber: "bg-amber-500 text-white",
  };
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-black shadow-sm ${classes[tone]}`}>
      {children}
    </button>
  );
}

function NotificationDetailsModal({ row, onClose, onAction }: { row: NotificationRow; onClose: () => void; onAction: (action: string, row: NotificationRow) => void }) {
  const fields = [
    ["الشدة", row.severityLabel],
    ["المصدر", row.sourceLabel],
    ["الحالة", row.statusLabel],
    ["المندوب", row.driverName],
    ["المدينة", row.cityName],
    ["التطبيق", row.appName],
    ["المشروع", row.projectName],
    ["القيمة الحالية", row.currentValue],
    ["المطلوب", row.requiredValue],
    ["التاريخ", row.createdAt],
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-2xl font-black text-slate-950">{row.title}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.detail}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">
            إغلاق
          </button>
        </div>
        <div className="max-h-[64vh] overflow-auto p-5">
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-500">{label}</p>
                <strong className="mt-1 block text-sm font-black text-slate-950">{value}</strong>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">
            <strong className="block text-base text-amber-950">الإجراء المقترح</strong>
            {row.recommendation}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton onClick={() => onAction("تقرير المندوب", row)}>تقرير المندوب</ActionButton>
            <ActionButton onClick={() => onAction("تقرير المدينة", row)}>تقرير المدينة</ActionButton>
            <ActionButton onClick={() => onAction("إنشاء مهمة", row)} tone="blue">إنشاء مهمة</ActionButton>
            <ActionButton onClick={() => onAction("حل التنبيه", row)} tone="green">حل التنبيه</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function uniqueValues(rows: NotificationRow[], key: "cityName" | "appName" | "statusLabel" | "sourceLabel") {
  return [...new Set(rows.map((row) => row[key]).filter((value) => value && value !== "-"))].sort();
}

function csvEscape(value: string) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function NotificationsAlertsClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<FilterValue>("all");
  const [city, setCity] = useState<FilterValue>("all");
  const [appName, setAppName] = useState<FilterValue>("all");
  const [status, setStatus] = useState<FilterValue>("all");
  const [source, setSource] = useState<FilterValue>("all");
  const [selectedRow, setSelectedRow] = useState<NotificationRow | null>(null);

  const options = useMemo(
    () => ({
      cities: uniqueValues(data.rows, "cityName"),
      apps: uniqueValues(data.rows, "appName"),
      statuses: uniqueValues(data.rows, "statusLabel"),
      sources: uniqueValues(data.rows, "sourceLabel"),
    }),
    [data.rows],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      const matchesSearch = q ? `${row.title} ${row.detail} ${row.driverName} ${row.cityName} ${row.appName} ${row.projectName}`.toLowerCase().includes(q) : true;
      const matchesSeverity = severity === "all" ? true : row.severity === severity;
      const matchesCity = city === "all" ? true : row.cityName === city;
      const matchesApp = appName === "all" ? true : row.appName === appName;
      const matchesStatus = status === "all" ? true : row.statusLabel === status;
      const matchesSource = source === "all" ? true : row.sourceLabel === source;
      return matchesSearch && matchesSeverity && matchesCity && matchesApp && matchesStatus && matchesSource;
    });
  }, [appName, city, data.rows, query, severity, source, status]);

  function submitDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = String(form.get("from") ?? "");
    const to = String(form.get("to") ?? "");
    router.push(`/notifications?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  function exportCsv() {
    const headers = ["التنبيه", "الشدة", "المصدر", "المندوب", "المدينة", "التطبيق", "القيمة", "المطلوب", "الحالة", "التاريخ"];
    const lines = [
      headers.map(csvEscape).join(","),
      ...filteredRows.map((row) =>
        [row.title, row.severityLabel, row.sourceLabel, row.driverName, row.cityName, row.appName, row.currentValue, row.requiredValue, row.statusLabel, row.createdAt].map(csvEscape).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notifications-${data.filters.from}-${data.filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createTask(row: NotificationRow) {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        description: `${row.detail}\n${row.recommendation}`,
        driverId: row.driverId || undefined,
        priority: row.severity,
        status: "PENDING",
      }),
    });
    if (!response.ok) {
      setToast("تعذر إنشاء المهمة حالياً.");
      return;
    }
    setToast("تم إنشاء مهمة للمشرفين مرتبطة بالتنبيه.");
  }

  async function resolveAlert(row: NotificationRow) {
    if (row.source !== "saved") {
      setToast("هذا تنبيه مولد من البيانات، وسيختفي تلقائياً عند معالجة السبب في التقارير أو الحسابات.");
      return;
    }
    const response = await fetch(`/api/notifications/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    if (!response.ok) {
      setToast("تعذر تحديث حالة التنبيه حالياً.");
      return;
    }
    setToast("تم تعليم التنبيه كمحلول.");
    router.refresh();
  }

  function rowAction(action: string, row: NotificationRow) {
    if (action === "تفاصيل") {
      setSelectedRow(row);
      return;
    }
    if (action === "تقرير المندوب") {
      if (row.driverId) router.push(`/rider-kpi?driverId=${encodeURIComponent(row.driverId)}`);
      else setToast("لا يوجد مندوب مربوط بهذا التنبيه.");
      return;
    }
    if (action === "تقرير المدينة") {
      if (row.cityName !== "-") router.push(`/cities?q=${encodeURIComponent(row.cityName)}`);
      else setToast("لا توجد مدينة مرتبطة بهذا التنبيه.");
      return;
    }
    if (action === "إنشاء مهمة") {
      void createTask(row);
      return;
    }
    if (action === "حل التنبيه") {
      void resolveAlert(row);
      return;
    }
    setToast(actionMessage);
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-black text-red-950">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-red-800">{data.databaseMessage}</p>
          <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-xl bg-red-700 px-5 py-2 text-sm font-black text-white">
            تحديث الصفحة
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {selectedRow ? <NotificationDetailsModal row={selectedRow} onClose={() => setSelectedRow(null)} onAction={rowAction} /> : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-950">الإشعارات والتنبيهات</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">تنبيهات مولدة من مشاكل تشغيلية حقيقية وقابلة للتكليف والمتابعة.</p>
        </div>
        <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          رجوع
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setToast(actionMessage)} tone="green">+ إضافة</ActionButton>
            <ActionButton onClick={() => router.push("/imports/preview?importType=keeta_invoice")} tone="blue">استيراد Excel / PDF</ActionButton>
            <ActionButton onClick={() => setToast(actionMessage)}>تعديل</ActionButton>
            <ActionButton onClick={() => setToast(actionMessage)} tone="red">حذف</ActionButton>
            <ActionButton onClick={exportCsv} tone="amber">تصدير إكسل</ActionButton>
            <ActionButton onClick={() => window.print()}>طباعة / PDF</ActionButton>
            <ActionButton onClick={() => router.push("/imports/templates?fileType=keeta_invoice")}>قالب Keeta</ActionButton>
          </div>

          <form onSubmit={submitDates} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label htmlFor="notifications-from" className="grid gap-1 text-xs font-black text-slate-700">
              من تاريخ
              <input id="notifications-from" name="from" type="date" defaultValue={data.filters.from} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
            </label>
            <label htmlFor="notifications-to" className="grid gap-1 text-xs font-black text-slate-700">
              إلى تاريخ
              <input id="notifications-to" name="to" type="date" defaultValue={data.filters.to} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
            </label>
            <button type="submit" className="self-end rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
              تطبيق
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="حرج" value={data.summary.critical} tone="red" />
        <SummaryCard title="تحذير" value={data.summary.warning} tone="amber" />
        <SummaryCard title="معلومة" value={data.summary.info} tone="blue" />
        <SummaryCard title="تم الحل" value={data.summary.resolved} tone="emerald" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label htmlFor="notifications-search" className="grid gap-1 text-xs font-black text-slate-800 xl:col-span-2">
            بحث
            <input id="notifications-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مندوب / مدينة / تطبيق / سبب..." className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          </label>
          <label htmlFor="notifications-severity" className="grid gap-1 text-xs font-black text-slate-800">
            الشدة
            <select id="notifications-severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل الشدات</option>
              <option value="CRITICAL">حرج</option>
              <option value="WARNING">تحذير</option>
              <option value="INFO">معلومة</option>
            </select>
          </label>
          <label htmlFor="notifications-city" className="grid gap-1 text-xs font-black text-slate-800">
            المدينة
            <select id="notifications-city" value={city} onChange={(event) => setCity(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل المدن</option>
              {options.cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label htmlFor="notifications-app" className="grid gap-1 text-xs font-black text-slate-800">
            التطبيق
            <select id="notifications-app" value={appName} onChange={(event) => setAppName(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل التطبيقات</option>
              {options.apps.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label htmlFor="notifications-source" className="grid gap-1 text-xs font-black text-slate-800">
            المصدر
            <select id="notifications-source" value={source} onChange={(event) => setSource(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل المصادر</option>
              {options.sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label htmlFor="notifications-status" className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select id="notifications-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل الحالات</option>
              {options.statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">
        فورمات Keeta اليومي الأساسي: {data.keetaTemplate.requiredColumns.join(" / ")}. الأعمدة الأخرى محفوظة كاختيارية داخل قالب Keeta Daily Report.
      </div>

      <div className="table-scroll rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {!filteredRows.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            لا توجد تنبيهات مطابقة للفلاتر الحالية.
          </div>
        ) : (
          <table className="min-w-[1420px] w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {["التنبيه", "الشدة", "المصدر", "المندوب", "المدينة", "التطبيق", "القيمة", "المطلوب", "الحالة", "إجراءات"].map((head) => (
                  <th key={head} className="whitespace-nowrap px-3 py-2 font-black">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => rowAction("تفاصيل", row)} className="text-right font-black text-slate-950 hover:text-blue-700">
                      {row.title}
                    </button>
                    <div className="mt-1 text-[11px] font-bold text-slate-500">{row.detail}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2"><SeverityBadge severity={row.severity} label={row.severityLabel} /></td>
                  <td className="whitespace-nowrap px-3 py-2">{row.sourceLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold">{row.driverName}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.cityName}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.appName}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-black">{row.currentValue}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold">{row.requiredValue}</td>
                  <td className="whitespace-nowrap px-3 py-2"><StatusBadge label={row.statusLabel} /></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <ActionButton onClick={() => rowAction("تفاصيل", row)}>تفاصيل</ActionButton>
                      <ActionButton onClick={() => rowAction("تقرير المندوب", row)}>تقرير المندوب</ActionButton>
                      <ActionButton onClick={() => rowAction("تقرير المدينة", row)}>تقرير المدينة</ActionButton>
                      <ActionButton onClick={() => rowAction("إنشاء مهمة", row)} tone="blue">إنشاء مهمة</ActionButton>
                      <ActionButton onClick={() => rowAction("حل التنبيه", row)} tone="green">حل التنبيه</ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
