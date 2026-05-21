"use client";

import { useMemo, useState } from "react";
import type { ImportPreviewPayload } from "@/lib/imports/previewImport";
import type { ImportPreviewRow } from "@/lib/imports/validateRows";

function statusClass(severity: string) {
  if (severity === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadRows(fileName: string, rows: ImportPreviewRow[]) {
  const header = ["Row Number", "Status", "Main Identifier", "Matched Driver", "Matched Vehicle", "Application Account", "Error Type", "Error Message"].join(",");
  const body = rows
    .map((row) =>
      [
        row.rowNumber,
        row.status,
        row.mainIdentifier,
        row.matchedDriver ? `${row.matchedDriver.code} - ${row.matchedDriver.name}` : "",
        row.matchedVehicle?.label ?? "",
        row.matchedApplicationAccount?.appUserId || row.matchedApplicationAccount?.appUsername || "",
        row.errorType ?? "",
        row.errorMessage ?? "",
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function recomputePreview(preview: ImportPreviewPayload, rows: ImportPreviewRow[]): ImportPreviewPayload {
  const invalidRows = rows.filter((row) => row.severity === "error").length;
  const duplicateRows = rows.filter((row) => row.errorType === "duplicate_row" || row.errorType === "duplicate_match").length;
  const missingDrivers = rows.filter((row) => row.errorType === "missing_driver").length;
  const missingVehicles = rows.filter((row) => row.errorType === "missing_vehicle").length;
  const missingApplicationAccounts = rows.filter((row) => row.errorType === "unlinked_account").length;

  return {
    ...preview,
    rows,
    summary: {
      ...preview.summary,
      validRows: rows.filter((row) => row.severity !== "error").length,
      invalidRows,
      duplicateRows,
      missingDrivers,
      missingVehicles,
      missingApplicationAccounts,
      rowsReadyToSave: rows.filter((row) => row.severity !== "error").length,
    },
  };
}

export function ImportPreviewTable({
  preview,
  onRowAction,
  onPreviewChange,
}: {
  preview: ImportPreviewPayload;
  onRowAction: (action: string) => void;
  onPreviewChange?: (preview: ImportPreviewPayload) => void;
}) {
  const [detailsRow, setDetailsRow] = useState<ImportPreviewRow | null>(null);
  const errorRows = useMemo(() => preview.rows.filter((row) => row.severity === "error" || row.errorType), [preview.rows]);

  function ignoreRow(row: ImportPreviewRow) {
    const rows = preview.rows.map((item) =>
      item.rowNumber === row.rowNumber
        ? {
            ...item,
            status: "ignored",
            severity: "error" as const,
            errorType: "ignored",
            errorMessage: "تم تجاهل هذا الصف بناءً على اختيار المستخدم ولن يتم حفظه عند الاعتماد.",
          }
        : item,
    );
    onPreviewChange?.(recomputePreview(preview, rows));
    onRowAction("تم تجاهل الصف ولن يدخل في الحفظ.");
  }

  function revalidateRow(row: ImportPreviewRow) {
    if (row.errorType !== "ignored") {
      onRowAction(row.errorMessage ? "الصف تمت مراجعته، وما زالت الرسالة ظاهرة في عمود الخطأ." : "الصف جاهز ولا توجد مشاكل تحتاج إعادة تحقق.");
      return;
    }
    const rows = preview.rows.map((item) =>
      item.rowNumber === row.rowNumber
        ? {
            ...item,
            status: "ready",
            severity: "ready" as const,
            errorType: undefined,
            errorMessage: "",
          }
        : item,
    );
    onPreviewChange?.(recomputePreview(preview, rows));
    onRowAction("تمت إعادة الصف إلى حالة جاهز.");
  }

  function exportErrors() {
    if (!errorRows.length) {
      onRowAction("لا توجد أخطاء لتصديرها في هذه المعاينة.");
      return;
    }
    downloadRows(`import-errors-${new Date().toISOString().slice(0, 10)}.csv`, errorRows);
    onRowAction("تم تحميل ملف الأخطاء.");
  }

  return (
    <div className="space-y-4">
      {preview.missingColumns.length ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          توجد أعمدة مطلوبة غير موجودة في الملف: {preview.missingColumns.map((column) => column.displayName).join("، ")}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadRows(`import-preview-${new Date().toISOString().slice(0, 10)}.csv`, preview.rows)}
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-800 hover:bg-blue-100"
        >
          تحميل المعاينة
        </button>
        <button
          type="button"
          onClick={exportErrors}
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800 hover:bg-amber-100"
        >
          تصدير الأخطاء
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = `/imports/templates?fileType=${encodeURIComponent(preview.summary.importType)}`;
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          تغيير مطابقة الأعمدة
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1250px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {[
                "رقم الصف",
                "الحالة",
                "المعرف الرئيسي",
                "المندوب المطابق",
                "السيارة المطابقة",
                "حساب التطبيق",
                "نوع الخطأ",
                "رسالة الخطأ",
                "إجراءات",
              ].map((head) => (
                <th key={head} className="whitespace-nowrap px-4 py-3">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => (
              <tr key={row.rowNumber} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-black">{row.rowNumber}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(row.severity)}`}>{row.status}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{row.mainIdentifier || "-"}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.matchedDriver ? `${row.matchedDriver.code} - ${row.matchedDriver.name}` : "-"}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.matchedVehicle ? row.matchedVehicle.label : "-"}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.matchedApplicationAccount?.appUserId || row.matchedApplicationAccount?.appUsername || "-"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-600">{row.errorType || "-"}</td>
                <td className="min-w-72 px-4 py-3 text-xs font-bold text-slate-600">{row.errorMessage || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailsRow(row)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      عرض البيانات الخام
                    </button>
                    <button
                      type="button"
                      onClick={() => onRowAction(row.matchedDriver ? "الصف مرتبط بمندوب بالفعل." : "الربط اليدوي بمندوب يحتاج شاشة اختيار وسيتم تنفيذه في مرحلة الربط اليدوي.")}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      ربط بمندوب
                    </button>
                    <button
                      type="button"
                      onClick={() => onRowAction(row.matchedVehicle ? "الصف مرتبط بسيارة بالفعل." : "لا توجد سيارة مطابقة في الصف. الربط اليدوي بالسيارة سيتم من شاشة اختيار السيارة.")}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      ربط بسيارة
                    </button>
                    <button
                      type="button"
                      onClick={() => ignoreRow(row)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      تجاهل الصف
                    </button>
                    <button
                      type="button"
                      onClick={() => revalidateRow(row)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
                      إعادة التحقق
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailsRow ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">تفاصيل الصف رقم {detailsRow.rowNumber}</h3>
                <p className="text-sm font-bold text-slate-500">{detailsRow.mainIdentifier || "بدون معرف رئيسي"}</p>
              </div>
              <button type="button" onClick={() => setDetailsRow(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                إغلاق
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-black text-slate-800">البيانات الخام من الملف</h4>
                <pre className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-left text-xs font-bold leading-6 text-slate-100" dir="ltr">
                  {JSON.stringify(detailsRow.rawData, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-black text-slate-800">البيانات بعد المطابقة</h4>
                <pre className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-left text-xs font-bold leading-6 text-slate-100" dir="ltr">
                  {JSON.stringify(detailsRow.mappedData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
