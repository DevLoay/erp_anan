"use client";

import Link from "next/link";
import type { ApplicationProjectRow } from "@/lib/applications/getApplicationDetails";

type Props = {
  rows: ApplicationProjectRow[];
  onAction: (action: string, row: ApplicationProjectRow) => void;
};

function projectActionLinks(row: ApplicationProjectRow) {
  const routeId = row.routeId ?? row.id;
  return [
    ["عرض المشروع", `/projects/${routeId}/dashboard`],
    ["استيراد تقرير", `/projects/${routeId}/imports`],
    ["الفواتير", `/projects/${routeId}/invoices`],
    ["المسير", `/projects/${routeId}/payroll`],
    ["التقارير", `/projects/${routeId}/reports`],
    ["الإعدادات", `/projects/${routeId}/settings`],
  ] as const;
}

export function ApplicationProjectsTable({ rows, onAction: _onAction }: Props) {
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">لا توجد مشاريع مرتبطة بهذا التطبيق.</div>;
  }

  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1200px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {["كود المشروع", "اسم المشروع", "المدينة", "تارجت الشهر", "تارجت اليوم", "عدد المناديب", "عدد الحسابات", "التقارير", "المسيرات", "الحالة", "إجراءات"].map((head) => (
              <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-bold">{row.code}</td>
              <td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">{row.name}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.cityName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.monthlyTarget ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.dailyTarget ?? "-"}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.driversCount}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.accountsCount}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.reportsCount}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.payrollRuns}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {projectActionLinks(row).map(([label, href]) => (
                    <Link key={href} href={href} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">
                      {label}
                    </Link>
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
