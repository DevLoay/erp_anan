"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportHistoryData, ImportHistoryRow } from "@/lib/imports/importHistory";

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

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
    </div>
  );
}

export function ImportHistoryClient({ data }: { data: ImportHistoryData }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [rows, setRows] = useState(data.rows);

  async function action(row: ImportHistoryRow, type: "commit" | "cancel" | "revalidate") {
    const res = await fetch(`/api/imports/history/${row.id}/${type}`, { method: "POST" });
    const payload = await res.json();
    setToast(payload.message ?? payload.error ?? "تم تنفيذ الإجراء");
    router.refresh();
  }

  async function exportErrors(row: ImportHistoryRow) {
    const res = await fetch(`/api/imports/history/${row.id}`);
    const payload = (await res.json().catch(() => ({}))) as {
      data?: { batch?: { rows?: { rowNumber: number; errorType: string; errorMessage: string; rawData: unknown }[] } };
      error?: string;
    };
    if (!res.ok) {
      setToast(payload.error || "تعذر تحميل أخطاء عملية الاستيراد.");
      return;
    }
    const errorRows = payload.data?.batch?.rows?.filter((item) => item.errorType || item.errorMessage) ?? [];
    const lines = [
      ["rowNumber", "errorType", "errorMessage", "rawData"].join(","),
      ...errorRows.map((item) =>
        [
          item.rowNumber,
          item.errorType,
          item.errorMessage,
          JSON.stringify(item.rawData ?? {}),
        ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-errors-${row.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(errorRows.length ? "تم تصدير أخطاء الاستيراد." : "لا توجد أخطاء مسجلة في هذه العملية.");
  }

  if (data.databaseStatus === "offline") {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-800">{data.databaseMessage}</div>;
  }

  return (
    <section className="space-y-5" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard title="إجمالي العمليات" value={data.summary.total} />
        <MetricCard title="الناجحة" value={data.summary.successful} />
        <MetricCard title="بها أخطاء" value={data.summary.withErrors} />
        <MetricCard title="Preview غير معتمد" value={data.summary.previews} />
        <MetricCard title="إجمالي الصفوف" value={data.summary.totalRows} />
        <MetricCard title="الصفوف الصحيحة" value={data.summary.validRows} />
        <MetricCard title="الصفوف الخطأ" value={data.summary.invalidRows} />
        <MetricCard title="آخر عملية" value={data.summary.lastImport} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <input onChange={(event) => setRows(data.rows.filter((row) => row.fileType.toLowerCase().includes(event.target.value.toLowerCase())))} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="File Type" />
        <input onChange={(event) => setRows(data.rows.filter((row) => row.applicationName.toLowerCase().includes(event.target.value.toLowerCase())))} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Application" />
        <input onChange={(event) => setRows(data.rows.filter((row) => row.projectName.toLowerCase().includes(event.target.value.toLowerCase())))} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Project" />
        <input onChange={(event) => setRows(data.rows.filter((row) => row.status.toLowerCase().includes(event.target.value.toLowerCase())))} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Status" />
        <button type="button" onClick={() => setRows(data.rows)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
          عرض الكل
        </button>
      </div>

      {!rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="text-lg font-black text-slate-950">لا توجد عمليات استيراد محفوظة حتى الآن.</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">ابدأ من صفحة الاستيراد وارفع ملفًا ثم اعتمد الحفظ.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1450px] text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {[
                  "File Name",
                  "File Type",
                  "Application",
                  "Project",
                  "Template",
                  "Total Rows",
                  "Valid Rows",
                  "Invalid Rows",
                  "Duplicate Rows",
                  "Missing Drivers",
                  "Unlinked Accounts",
                  "Status",
                  "Created By",
                  "Created At",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-black">{row.fileName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.fileType}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.applicationName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.templateName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.totalRows}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.validRows}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.invalidRows}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.duplicateRows}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.missingDrivers}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.unlinkedAccounts}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.createdBy}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/imports/history/${row.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                        عرض التفاصيل
                      </Link>
                      <button type="button" onClick={() => void exportErrors(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                        تصدير الأخطاء
                      </button>
                      <button type="button" onClick={() => void action(row, "commit")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800">
                        Commit
                      </button>
                      <button type="button" onClick={() => void action(row, "cancel")} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-800">
                        إلغاء
                      </button>
                      <button type="button" onClick={() => void action(row, "revalidate")} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">
                        إعادة التحقق
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
