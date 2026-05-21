"use client";

import type { ApplicationAccountRow } from "@/lib/applications/getApplicationDetails";

type Props = {
  rows: ApplicationAccountRow[];
  onAction: (action: string, row: ApplicationAccountRow) => void;
};

const actions = ["عرض المندوب", "تعديل الحساب", "فك الربط", "ربط بمندوب", "تعطيل الحساب"];

export function ApplicationAccountsTable({ rows, onAction }: Props) {
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">لا توجد حسابات تطبيق مرتبطة حتى الآن.</div>;
  }

  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1100px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {["كود المندوب", "اسم المندوب", "رقم الإقامة", "App User ID", "App Username", "المدينة", "المشروع", "الحالة", "تاريخ الربط", "إجراءات"].map((head) => (
              <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-bold">{row.driverCode}</td>
              <td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">{row.driverName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.nationalId}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUserId}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUsername}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.cityName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.linkedAt}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((action) => (
                    <button key={action} type="button" onClick={() => onAction(action, row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">
                      {action}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
