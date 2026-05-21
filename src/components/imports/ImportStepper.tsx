"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImportPreviewTable } from "./ImportPreviewTable";
import type { ImportPreviewPayload } from "@/lib/imports/previewImport";
import type { ImportTemplateRow } from "@/lib/imports/templates";

type Props = {
  templates: ImportTemplateRow[];
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
};

const importTypes = [
  ["drivers", "بيانات المناديب"],
  ["vehicles", "بيانات السيارات"],
  ["application_accounts", "حسابات التطبيقات"],
  ["keeta_invoice", "تقرير Keeta اليومي"],
  ["keeta_rank", "Keeta Rank"],
  ["hungerstation_invoice", "فاتورة HungerStation"],
  ["hungerstation_performance", "أداء HungerStation"],
  ["talabat_invoice", "فاتورة Talabat"],
  ["advances", "السلف"],
  ["deductions", "الخصومات"],
  ["violations", "المخالفات"],
  ["fuel", "البنزين"],
  ["hr_documents", "مستندات HR"],
  ["payroll", "مسير الرواتب"],
] as const;

const importTypeValues = new Set(importTypes.map(([value]) => value));

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

export function ImportStepper({ templates, applications, projects }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("importType") || searchParams.get("fileType") || searchParams.get("type") || "drivers";
  const [toast, setToast] = useState("");
  const [importType, setImportType] = useState(() => (importTypeValues.has(requestedType as (typeof importTypes)[number][0]) ? requestedType : "drivers"));
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  const filteredTemplates = useMemo(() => templates.filter((template) => template.fileType === importType), [importType, templates]);
  const activeTemplateId = templateId || filteredTemplates[0]?.id || "";

  async function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const form = new FormData(event.currentTarget);
      form.set("importType", importType);
      form.set("templateId", activeTemplateId);
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
        : "";
      setToast(`${payload.data?.message ?? "تم حفظ عملية الاستيراد."}${details}`);
      setPreview(null);
      router.refresh();
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
              {importTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

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

          <label className="grid gap-2 text-sm font-black text-slate-700 md:col-span-3">
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

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">
            {preview.message}
          </div>

          <ImportPreviewTable preview={preview} onPreviewChange={setPreview} onRowAction={(message) => setToast(message || "تم تنفيذ الإجراء.")} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void commitPreview()}
              disabled={committing || preview.summary.rowsReadyToSave === 0}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {committing ? "جاري الحفظ..." : "اعتماد الحفظ"}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">
              إلغاء المعاينة
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
