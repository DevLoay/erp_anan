"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { ImportPreviewTable } from "./ImportPreviewTable";
import type { KeetaRankData } from "@/lib/applications/keetaRank";
import type { KeetaRankMatchedRow } from "@/lib/imports/matchDrivers";

type PreviewState = {
  fileName: string;
  applicationId: string;
  applicationProjectId: string;
  rankSettingId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  duplicateRows: number;
  linkedDrivers: number;
  rows: KeetaRankMatchedRow[];
};

type Props = {
  data: KeetaRankData;
  onToast: (message: string) => void;
};

const steps = ["اختيار نوع الملف", "رفع الملف", "مطابقة الأعمدة", "Preview", "اعتماد الحفظ"];

export function KeetaRankImport({ data, onToast }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  async function previewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.keetaApplication) {
      onToast("لا يوجد تطبيق Keeta مسجل في قاعدة البيانات.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      onToast("اختر ملف Excel أو CSV أولًا");
      return;
    }
    form.set("file", file);
    setLoading(true);
    try {
      const res = await fetch("/api/imports/keeta-rank/preview", { method: "POST", body: form });
      const body = (await res.json()) as { data?: PreviewState; error?: string };
      if (!res.ok || !body.data) throw new Error(body.error ?? "تعذر إنشاء Preview");
      setPreview(body.data);
      onToast("تم إنشاء Preview بدون حفظ أي بيانات");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر قراءة الملف");
    } finally {
      setLoading(false);
    }
  }

  async function commitPreview() {
    if (!preview) return;
    setCommitting(true);
    try {
      const res = await fetch("/api/imports/keeta-rank/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: preview.fileName,
          applicationId: preview.applicationId,
          applicationProjectId: preview.applicationProjectId,
          rankSettingId: preview.rankSettingId,
          rows: preview.rows,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "تعذر اعتماد الاستيراد");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onToast("تم اعتماد Keeta Rank وحفظ الصفوف في PostgreSQL");
      router.refresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر اعتماد الاستيراد");
    } finally {
      setCommitting(false);
    }
  }

  function downloadPreview() {
    if (!preview) {
      onToast("لا توجد معاينة لتصديرها");
      return;
    }
    const blob = new Blob([JSON.stringify(preview.rows, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keeta-rank-preview.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadErrors() {
    if (!preview) {
      onToast("لا توجد أخطاء لتصديرها");
      return;
    }
    const errors = preview.rows.filter((row) => !row.isValid);
    if (!errors.length) {
      onToast("لا توجد أخطاء في المعاينة الحالية");
      return;
    }
    const blob = new Blob([JSON.stringify(errors, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keeta-rank-errors.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">استيراد Rank Keeta</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">لا يتم حفظ أي صف قبل ظهور الـ Preview واعتماد الحفظ صراحة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <span key={step} className={`rounded-full border px-3 py-1 text-xs font-black ${preview || index < 3 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {index + 1}. {step}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={previewFile} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-xs font-black text-slate-600">
          <span>Application</span>
          <input value="Keeta" disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
        </label>
        <label htmlFor="keeta-project" className="space-y-1 text-xs font-black text-slate-600">
          <span>Project</span>
          <select id="keeta-project" name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">كل المشاريع</option>
            {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label htmlFor="keeta-rank-setting" className="space-y-1 text-xs font-black text-slate-600">
          <span>Rank Setting</span>
          <select id="keeta-rank-setting" name="rankSettingId" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">بدون إعداد محدد</option>
            {data.rankSettings.map((setting) => <option key={setting.id} value={setting.id}>{setting.name} - {setting.projectName}</option>)}
          </select>
        </label>
        <label htmlFor="keeta-rank-file" className="space-y-1 text-xs font-black text-slate-600">
          <span>Excel / CSV File</span>
          <input id="keeta-rank-file" ref={fileRef} name="file" type="file" accept=".xlsx,.xls,.csv" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading || !data.keetaApplication} className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "جاري المعاينة..." : "إنشاء Preview"}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Total Rows" value={preview.totalRows} tone="slate" />
            <MetricCard title="Valid Rows" value={preview.validRows} tone="emerald" />
            <MetricCard title="Invalid Rows" value={preview.invalidRows} tone={preview.invalidRows ? "red" : "emerald"} />
            <MetricCard title="Duplicates" value={preview.duplicateRows} tone={preview.duplicateRows ? "orange" : "slate"} />
            <MetricCard title="Missing Drivers" value={preview.missingDrivers} tone={preview.missingDrivers ? "red" : "slate"} />
            <MetricCard title="Unlinked Accounts" value={preview.unlinkedAccounts} tone={preview.unlinkedAccounts ? "amber" : "slate"} />
            <MetricCard title="Linked Drivers" value={preview.linkedDrivers} tone="blue" />
            <MetricCard title="File" value={preview.fileName} tone="slate" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={commitPreview} disabled={committing} className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-60">
              {committing ? "جاري الحفظ..." : "Confirm Import"}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700">Cancel Import</button>
            <button type="button" onClick={downloadErrors} className="rounded-xl border border-red-200 bg-red-50 px-5 py-2 text-sm font-black text-red-700">Download Error Report</button>
            <button type="button" onClick={downloadPreview} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-black text-blue-700">Download Preview</button>
            <button type="button" onClick={() => window.location.assign("/projects/keeta/imports?type=keeta_rank_template")} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700">Go back and change column mapping</button>
          </div>
          <ImportPreviewTable rows={preview.rows} />
        </div>
      ) : null}
    </section>
  );
}
