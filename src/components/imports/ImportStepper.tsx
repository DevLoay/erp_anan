"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GENERAL_IMPORT_TYPES, importTypeLabel, PROJECT_IMPORT_TYPES } from "@/lib/imports/importScopes";
import { ImportPreviewTable } from "./ImportPreviewTable";
import type { ImportPreviewPayload } from "@/lib/imports/previewImport";
import type { ImportTemplateRow } from "@/lib/imports/templates";

type Props = {
  templates: ImportTemplateRow[];
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  cities?: { id: string; name: string }[];
  allowedImportTypes?: string[];
  lockedApplicationId?: string;
  lockedProjectId?: string;
  lockedLegacyProjectId?: string;
  lockedCityId?: string;
  lockedMonth?: string;
  scopeLabel?: string;
};

const importTypes = [
  ...GENERAL_IMPORT_TYPES,
  ...PROJECT_IMPORT_TYPES,
  "payroll",
].map((value) => [value, importTypeLabel(value)] as const);

const dailyReportTypes = new Set(PROJECT_IMPORT_TYPES);
const dailyReportCommitTypes = new Set(["keeta_period_report_template", "hungerstation_performance", "talabat_invoice", "keeta_invoice", "keeta_rank"]);
const invoiceCommitTypes = new Set(["keeta_driver_invoice_template", "hungerstation_invoice"]);
const rankCommitTypes = new Set(["keeta_rank_template"]);

function appNameForImportType(value: string) {
  if (value.startsWith("keeta")) return "Keeta";
  if (value.startsWith("hungerstation")) return "HungerStation";
  if (value.startsWith("talabat")) return "Talabat";
  return "";
}

function reportDateFromPreview(preview: ImportPreviewPayload) {
  const row = preview.rows.find((item) => item.mappedData.reportDate || item.mappedData.date);
  const value = row?.mappedData.reportDate || row?.mappedData.date;
  const raw = String(value ?? "").trim();
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[80] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
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

function readonlyBox(label: string, value: string) {
  return (
    <div className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950">{value}</div>
    </div>
  );
}

export function ImportStepper({
  templates,
  applications,
  projects,
  cities = [],
  allowedImportTypes,
  lockedApplicationId,
  lockedProjectId,
  lockedLegacyProjectId,
  lockedCityId,
  lockedMonth,
  scopeLabel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const availableImportTypes = useMemo(() => {
    const allowed = new Set(allowedImportTypes?.length ? allowedImportTypes : importTypes.map(([value]) => value));
    return importTypes.filter(([value]) => allowed.has(value));
  }, [allowedImportTypes]);
  const fallbackImportType = availableImportTypes[0]?.[0] ?? "drivers";
  const requestedType = searchParams.get("importType") || searchParams.get("fileType") || searchParams.get("type") || fallbackImportType;
  const requestedAllowed = availableImportTypes.some(([value]) => value === requestedType);
  const [toast, setToast] = useState("");
  const [importType, setImportType] = useState(() => (requestedAllowed ? requestedType : fallbackImportType));
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  const lockedApplication = applications.find((app) => app.id === lockedApplicationId);
  const lockedProject = projects.find((project) => project.id === lockedProjectId);
  const filteredTemplates = useMemo(() => templates.filter((template) => template.fileType === importType), [importType, templates]);
  const activeTemplateId = templateId || filteredTemplates[0]?.id || "";
  const requiresHungerStationReportDate = importType === "hungerstation_performance";
  const requiresHungerStationInvoiceMonth = importType === "hungerstation_invoice";

  async function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const form = new FormData(event.currentTarget);
      form.set("importType", importType);
      form.set("templateId", activeTemplateId);
      if (lockedApplicationId) form.set("applicationId", lockedApplicationId);
      if (lockedProjectId) form.set("applicationProjectId", lockedProjectId);
      if (lockedLegacyProjectId) form.set("projectId", lockedLegacyProjectId);
      if (lockedCityId) form.set("cityId", lockedCityId);
      const requestedMonth = lockedMonth || searchParams.get("month") || "";
      if (requestedMonth) form.set("month", requestedMonth);
      const res = await fetch("/api/imports/preview", { method: "POST", body: form });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "تعذر إنشاء المعاينة.");
      setPreview(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المعاينة.");
    } finally {
      setLoading(false);
    }
  }

  async function commitPreview() {
    if (!preview) return;
    setCommitting(true);
    setError("");
    try {
      const res = await fetch("/api/imports/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "تعذر حفظ عملية الاستيراد.");
      const details = payload.data?.drivers
        ? ` المناديب: جديد ${payload.data.drivers.createdDrivers}، تحديث ${payload.data.drivers.updatedDrivers}، حسابات تطبيق ${payload.data.drivers.createdAccounts + payload.data.drivers.updatedAccounts}.`
        : payload.data?.hungerStationRecords
          ? ` هنجرستيشن: يومي جديد ${payload.data.hungerStationRecords.createdDailyReports ?? 0}، يومي تحديث ${payload.data.hungerStationRecords.updatedDailyReports ?? 0}، فواتير جديدة ${payload.data.hungerStationRecords.createdInvoices ?? 0}، فواتير تحديث ${payload.data.hungerStationRecords.updatedInvoices ?? 0}.`
          : payload.data?.reports
            ? ` التقارير اليومية: جديد ${payload.data.reports.createdReports}، تحديث ${payload.data.reports.updatedReports}.`
            : "";
      setToast(`${payload.data?.message ?? "تم حفظ عملية الاستيراد."}${details}`);
      const committedType = preview.summary.importType;
      const committedDate = reportDateFromPreview(preview);
      const committedProjectId = preview.summary.applicationProjectId;
      const committedProjectRoute = committedProjectId;
      setPreview(null);
      router.refresh();
      if (dailyReportCommitTypes.has(committedType) && (committedDate || payload.data?.reports || payload.data?.keetaRecords?.createdDailyReports || payload.data?.keetaRecords?.updatedDailyReports)) {
        const query = new URLSearchParams({ fromDate: committedDate, toDate: committedDate });
        const appName = appNameForImportType(committedType);
        if (appName) query.set("appName", appName);
        router.push(`/daily-reports?${query.toString()}`);
        return;
      }
      if (invoiceCommitTypes.has(committedType) && committedProjectRoute) {
        router.push(`/projects/${committedProjectRoute}/invoices`);
        return;
      }
      if (committedType === "hungerstation_invoice") {
        const query = new URLSearchParams({ appName: "HungerStation" });
        if (preview.summary.month) query.set("month", preview.summary.month);
        router.push(`/daily-reports?${query.toString()}`);
        return;
      }
      if (rankCommitTypes.has(committedType) && committedProjectRoute) {
        router.push(`/projects/${committedProjectRoute}/imports`);
        return;
      }
      if (dailyReportTypes.has(committedType as (typeof PROJECT_IMPORT_TYPES)[number]) && committedProjectRoute) {
        router.push(`/projects/${committedProjectRoute}/reports${committedDate ? `?dateFrom=${committedDate}&dateTo=${committedDate}` : ""}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ عملية الاستيراد.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <section className="space-y-5" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {["اختيار النوع", "رفع الملف", "مطابقة الأعمدة", "Preview", "اعتماد الحفظ"].map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-600 text-white">{index + 1}</span>
              {step}
            </div>
          ))}
        </div>

        {scopeLabel ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            هذا الاستيراد مقفول على: <strong>{scopeLabel}</strong>. لا يمكن اعتماد تقرير مشروع بدون هذا الربط.
          </div>
        ) : null}

        <form onSubmit={submitPreview} className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            نوع الاستيراد
            <select
              value={importType}
              onChange={(event) => {
                setImportType(event.target.value);
                setTemplateId("");
                setPreview(null);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2"
            >
              {availableImportTypes.map(([value, label], index) => (
                <option key={`${value}:${index}`} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {lockedApplicationId ? (
            <>
              {readonlyBox("التطبيق", lockedApplication?.name ?? "تطبيق محدد")}
              <input type="hidden" name="applicationId" value={lockedApplicationId} />
            </>
          ) : (
            <label className="grid gap-2 text-sm font-black text-slate-700">
              التطبيق
              <select name="applicationId" className="rounded-xl border border-slate-300 px-3 py-2">
                <option value="">بدون تطبيق محدد</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {lockedProjectId ? (
            <>
              {readonlyBox("المشروع", lockedProject?.name ?? "مشروع محدد")}
              <input type="hidden" name="applicationProjectId" value={lockedProjectId} />
              {lockedLegacyProjectId ? <input type="hidden" name="projectId" value={lockedLegacyProjectId} /> : null}
            </>
          ) : (
            <label className="grid gap-2 text-sm font-black text-slate-700">
              المشروع
              <select name="applicationProjectId" className="rounded-xl border border-slate-300 px-3 py-2">
                <option value="">كل المشاريع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {lockedCityId ? (
            <input type="hidden" name="cityId" value={lockedCityId} />
          ) : cities.length ? (
            <label className="grid gap-2 text-sm font-black text-slate-700">
              المدينة
              <select name="cityId" className="rounded-xl border border-slate-300 px-3 py-2">
                <option value="">اختر المدينة</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-2 text-sm font-black text-slate-700">
            القالب
            <select value={activeTemplateId} onChange={(event) => setTemplateId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          {requiresHungerStationReportDate ? (
            <label className="grid gap-2 text-sm font-black text-slate-700">
              تاريخ تقرير HungerStation
              <input name="reportDate" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            </label>
          ) : null}

          {requiresHungerStationInvoiceMonth && !lockedMonth ? (
            <label className="grid gap-2 text-sm font-black text-slate-700">
              شهر فاتورة HungerStation
              <input name="month" required type="month" defaultValue={searchParams.get("month") || ""} className="rounded-xl border border-slate-300 px-3 py-2" />
            </label>
          ) : null}

          <label className={`grid gap-2 text-sm font-black text-slate-700 ${requiresHungerStationReportDate || requiresHungerStationInvoiceMonth ? "md:col-span-2" : "md:col-span-3"}`}>
            الملف
            <input name="file" required type="file" accept=".xlsx,.xls,.csv" className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
          </label>

          <button type="submit" disabled={loading} className="self-end rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? "جاري قراءة الملف..." : "عرض Preview قبل الحفظ"}
          </button>
        </form>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <SummaryCard title="Total Rows" value={preview.summary.totalRows} tone="blue" />
            <SummaryCard title="Valid Rows" value={preview.summary.validRows} tone="emerald" />
            <SummaryCard title="Invalid Rows" value={preview.summary.invalidRows} tone={preview.summary.invalidRows ? "red" : "emerald"} />
            <SummaryCard title="Duplicates" value={preview.summary.duplicateRows} tone={preview.summary.duplicateRows ? "amber" : "slate"} />
            <SummaryCard title="Missing Columns" value={preview.summary.missingRequiredColumns} tone={preview.summary.missingRequiredColumns ? "red" : "slate"} />
            <SummaryCard title="Missing Drivers" value={preview.summary.missingDrivers} tone={preview.summary.missingDrivers ? "red" : "slate"} />
            <SummaryCard title="Missing Vehicles" value={preview.summary.missingVehicles} tone={preview.summary.missingVehicles ? "amber" : "slate"} />
            <SummaryCard title="Ready To Save" value={preview.summary.rowsReadyToSave} tone="emerald" />
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{preview.message}</div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div>
              <p className="text-sm font-black text-emerald-950">هذه معاينة فقط، لم يتم حفظ أي بيانات بعد.</p>
              <p className="mt-1 text-xs font-bold text-emerald-800">
                الصفوف الجاهزة للحفظ: {preview.summary.rowsReadyToSave} من {preview.summary.totalRows}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void commitPreview()}
                disabled={committing || preview.summary.rowsReadyToSave === 0}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {committing ? "جاري الحفظ..." : "اعتماد الحفظ الآن"}
              </button>
              <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">
                إلغاء المعاينة
              </button>
            </div>
          </div>

          <ImportPreviewTable preview={preview} onPreviewChange={setPreview} onRowAction={(message) => setToast(message || "تم تنفيذ الإجراء.")} />
        </div>
      ) : null}
    </section>
  );
}
