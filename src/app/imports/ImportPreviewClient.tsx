"use client";

import Link from "next/link";
import { useState } from "react";

type PreviewResponse = {
  summary: Record<string, string | number | boolean>;
  columns: string[];
  rows: { rowNumber: number; status: string; severity: string; data: Record<string, unknown>; warnings: string[] }[];
};

function downloadPreview(preview: PreviewResponse) {
  const header = ["Row", "Status", ...preview.columns].join(",");
  const body = preview.rows
    .map((row) =>
      [row.rowNumber, row.status, ...preview.columns.map((column) => String(row.data[column] ?? "-"))]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `import-preview-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusClass(severity: string) {
  if (severity === "error") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ImportPreviewClient() {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    setNotice("");
    setPreview(null);
    try {
      const res = await fetch("/api/imports/preview", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setConfirming(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "تعذر اعتماد الاستيراد");
      const data = payload.data as { created?: number; updated?: number; skipped?: number };
      setNotice(`تم اعتماد الاستيراد. جديد: ${data.created ?? 0}، تحديث: ${data.updated ?? 0}، متخطى: ${data.skipped ?? 0}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر اعتماد الاستيراد");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-5">
      <form action={onSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <label htmlFor="import-type" className="grid gap-2 text-sm font-bold text-slate-700">
          نوع الاستيراد
          <select id="import-type" name="importType" className="rounded-md border border-slate-300 px-3 py-2">
            <option>Application Report</option>
            <option>Drivers</option>
            <option>Vehicles</option>
            <option>Payroll</option>
            <option>Finance</option>
          </select>
        </label>

        <label htmlFor="import-project" className="grid gap-2 text-sm font-bold text-slate-700">
          المشروع / التطبيق
          <input id="import-project" name="project" className="rounded-md border border-slate-300 px-3 py-2" placeholder="Keeta" />
        </label>

        <label htmlFor="import-file" className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
          الملف
          <input
            id="import-file"
            required
            name="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white md:col-span-4" disabled={loading}>
          {loading ? "جاري قراءة الملف..." : "عرض المعاينة قبل الحفظ"}
        </button>
      </form>

      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {Object.entries(preview.summary).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500">{key}</p>
                <strong className="mt-1 block text-lg font-black text-slate-950">{String(value)}</strong>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmImport()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={confirming}
            >
              {confirming ? "جاري الاعتماد..." : "اعتماد الاستيراد"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => downloadPreview(preview)}
              className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 hover:bg-sky-100"
            >
              تحميل المعاينة
            </button>
            <Link
              href="/excel-column-mapping"
              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 hover:bg-amber-100"
            >
              تغيير ربط الأعمدة
            </Link>
          </div>

          <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Status</th>
                  {preview.columns.map((column) => (
                    <th key={column} className="px-3 py-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 font-bold">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-bold">
                      <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(row.severity)}`}>{row.status}</span>
                    </td>
                    {preview.columns.map((column) => (
                      <td key={column} className="px-3 py-2">
                        {String(row.data[column] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">
            هذه شاشة معاينة فقط. لا يتم تسجيل دفعة الاستيراد إلا بعد الضغط على اعتماد الاستيراد، ولا يتم حفظ صفوف غير صالحة.
          </div>
        </div>
      ) : null}
    </div>
  );
}
