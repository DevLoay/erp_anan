"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { NotificationRow, NotificationsData, NotificationSeverity } from "@/lib/notifications/getNotificationsData";

type Props = {
  data: NotificationsData;
};

type FilterValue = "all" | string;

const actionMessage = "اختر تنبيهًا من الجدول أو افتح التفاصيل لتنفيذ الإجراء المرتبط.";

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

function dateOnly(value: string) {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function usableRouteValue(value: string) {
  const clean = String(value ?? "").trim();
  return clean && clean !== "-";
}

const resolvedStorageKey = "erp-resolved-notification-alerts";

function isResolved(row: NotificationRow) {
  return row.status === "APPROVED" || row.status === "LOCKED";
}

function buildLiveSummary(rows: NotificationRow[], resolvedCount: number) {
  return {
    critical: rows.filter((row) => row.severity === "CRITICAL" && !isResolved(row)).length,
    warning: rows.filter((row) => row.severity === "WARNING" && !isResolved(row)).length,
    info: rows.filter((row) => row.severity === "INFO" && !isResolved(row)).length,
    resolved: resolvedCount,
  };
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
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(resolvedStorageKey) || "[]") as string[];
      setResolvedKeys(new Set(saved));
    } catch {
      setResolvedKeys(new Set());
    }
  }, []);

  function markResolved(row: NotificationRow) {
    setResolvedKeys((current) => {
      const next = new Set(current);
      next.add(row.id);
      try {
        window.localStorage.setItem(resolvedStorageKey, JSON.stringify([...next]));
      } catch {
        // Local dismissal is only a UI convenience for generated alerts.
      }
      return next;
    });
    setSelectedRow(null);
  }

  const activeRows = useMemo(() => data.rows.filter((row) => !resolvedKeys.has(row.id) && !isResolved(row)), [data.rows, resolvedKeys]);
  const resolvedCount = useMemo(() => data.rows.filter((row) => resolvedKeys.has(row.id) || isResolved(row)).length, [data.rows, resolvedKeys]);
  const liveSummary = useMemo(() => buildLiveSummary(activeRows, resolvedCount), [activeRows, resolvedCount]);

  const options = useMemo(
    () => ({
      cities: uniqueValues(activeRows, "cityName"),
      apps: uniqueValues(activeRows, "appName"),
      statuses: uniqueValues(activeRows, "statusLabel"),
      sources: uniqueValues(activeRows, "sourceLabel"),
    }),
    [activeRows],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeRows.filter((row) => {
      const matchesSearch = q ? `${row.title} ${row.detail} ${row.driverName} ${row.cityName} ${row.appName} ${row.projectName}`.toLowerCase().includes(q) : true;
      const matchesSeverity = severity === "all" ? true : row.severity === severity;
      const matchesCity = city === "all" ? true : row.cityName === city;
      const matchesApp = appName === "all" ? true : row.appName === appName;
      const matchesStatus = status === "all" ? true : row.statusLabel === status;
      const matchesSource = source === "all" ? true : row.sourceLabel === source;
      return matchesSearch && matchesSeverity && matchesCity && matchesApp && matchesStatus && matchesSource;
    });
  }, [activeRows, appName, city, query, severity, source, status]);

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
    if (!row.cityId || !row.supervisorId) {
      setToast("لا يمكن إنشاء مهمة: التنبيه غير مربوط بمدينة ومشرف. راجع ربط المندوب أولًا.");
      return;
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const response = await fetch("/api/supervisor-tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        description: `${row.detail}\n${row.recommendation}`,
        category: "متابعة تنبيه",
        cityId: row.cityId,
        supervisorId: row.supervisorId,
        driverId: row.driverId || undefined,
        priority: row.severity,
        status: "PENDING",
        dueDate: dueDate.toISOString().slice(0, 10),
        notes: `تم إنشاؤها من تنبيه: ${row.sourceLabel}`,
      }),
    });
    if (!response.ok) {
      setToast("تعذر إنشاء المهمة حالياً.");
      return;
    }
    setToast("تم إنشاء مهمة للمشرفين مرتبطة بالتنبيه.");
  }

  async function createManualNotification() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "تنبيه يدوي",
        body: "تنبيه يدوي تمت إضافته من شاشة الإشعارات للمراجعة والمتابعة.",
        severity: "INFO",
        status: "PENDING",
        entityType: "manual",
      }),
    });
    if (!response.ok) {
      setToast("تعذر إضافة التنبيه اليدوي.");
      return;
    }
    setToast("تمت إضافة تنبيه يدوي جديد.");
    router.refresh();
  }

  async function deleteSelectedNotification() {
    if (!selectedRow) {
      setToast("افتح تفاصيل تنبيه محفوظ أولًا قبل الحذف.");
      return;
    }
    if (selectedRow.source !== "saved") {
      setToast("التنبيهات المولدة من التقارير لا تُحذف يدويًا؛ عالج السبب أو علّمها كمحلولة من التفاصيل.");
      return;
    }
    const response = await fetch(`/api/notifications/${selectedRow.id}`, { method: "DELETE" });
    if (!response.ok) {
      setToast("تعذر حذف التنبيه المحفوظ.");
      return;
    }
    setSelectedRow(null);
    setToast("تم حذف التنبيه المحفوظ.");
    router.refresh();
  }

  async function resolveAlert(row: NotificationRow) {
    if (row.source !== "saved") {
      markResolved(row);
      setToast("تم حل التنبيه وإخفاؤه من القائمة الحالية.");
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
    markResolved(row);
    setToast("تم تعليم التنبيه كمحلول وإخفاؤه من القائمة.");
    router.refresh();
  }

  function rowAction(action: string, row: NotificationRow) {
    if (action === "تفاصيل") {
      setSelectedRow(row);
      return;
    }
    if (action === "تقرير المندوب") {
      if (row.driverId) {
        const params = new URLSearchParams();
        const exactDate = row.source === "daily-report" || row.source === "saved" ? dateOnly(row.createdAt) : "";
        params.set("driverId", row.driverId);
        params.set("dateFrom", exactDate || data.filters.from);
        params.set("dateTo", exactDate || data.filters.to);
        if (usableRouteValue(row.appName)) params.set("appName", row.appName);
        router.push(`/rider-reports?${params.toString()}`);
      }
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
            <ActionButton onClick={() => void createManualNotification()} tone="green">+ إضافة</ActionButton>
            <ActionButton onClick={() => router.push("/projects?application=keeta&type=keeta_period_report_template")} tone="blue">استيراد Excel / PDF</ActionButton>
            <ActionButton onClick={() => (selectedRow ? setSelectedRow(selectedRow) : setToast("افتح تفاصيل التنبيه من الجدول لتعديله أو حله."))}>تعديل</ActionButton>
            <ActionButton onClick={() => void deleteSelectedNotification()} tone="red">حذف</ActionButton>
            <ActionButton onClick={exportCsv} tone="amber">تصدير إكسل</ActionButton>
            <ActionButton onClick={() => window.print()}>طباعة / PDF</ActionButton>
            <ActionButton onClick={() => router.push("/projects?application=keeta&type=keeta_period_report_template")}>قالب Keeta</ActionButton>
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
        <SummaryCard title="حرج" value={liveSummary.critical} tone="red" />
        <SummaryCard title="تحذير" value={liveSummary.warning} tone="amber" />
        <SummaryCard title="معلومة" value={liveSummary.info} tone="blue" />
        <SummaryCard title="تم الحل" value={liveSummary.resolved} tone="emerald" />
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
