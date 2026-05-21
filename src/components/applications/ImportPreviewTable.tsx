"use client";

import type { KeetaRankMatchedRow } from "@/lib/imports/matchDrivers";

type Props = {
  rows: KeetaRankMatchedRow[];
};

function statusClass(status: string) {
  if (status === "Valid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Missing Driver") return "border-red-200 bg-red-50 text-red-700";
  if (status === "Unlinked Account") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Duplicate Match") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ImportPreviewTable({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">
        لا توجد صفوف للمعاينة.
      </div>
    );
  }

  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1380px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {[
              "Row",
              "Driver Code",
              "Driver Name",
              "National ID",
              "App User ID",
              "App Username",
              "Rank",
              "Orders",
              "On Time",
              "Cancellation",
              "Rejection",
              "Working Hours",
              "Match Status",
              "Error Message",
            ].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.rowNumber} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-black">{row.rowNumber}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.driverCode || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.driverName || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.nationalId || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUserId || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUsername || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3 font-black">{row.rank || "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.orders ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.onTime ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.cancellation ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.rejection ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.workingHours ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(row.status)}`}>{row.status}</span>
              </td>
              <td className="min-w-64 px-4 py-3 text-xs font-bold text-slate-600">{row.errorMessage || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
