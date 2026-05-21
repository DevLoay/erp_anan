"use client";

import type { RankSettingRow } from "@/lib/applications/rankSettings";

type Props = {
  rows: RankSettingRow[];
  onAction: (action: string, row: RankSettingRow) => void;
};

function Badge({ value, tone = "slate" }: { value: string; tone?: "emerald" | "amber" | "red" | "slate" | "blue" }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
  return <span className={`rounded-full border px-2 py-1 text-xs font-black ${classes}`}>{value}</span>;
}

export function RankSettingsTable({ rows, onAction }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="text-lg font-black text-slate-950">لا توجد إعدادات رانك مسجلة حتى الآن.</h3>
        <p className="mt-2 text-sm font-bold text-slate-500">أضف Rank Setting للتطبيق أو المشروع حتى تظهر قواعد الأداء والـ Levels هنا.</p>
      </div>
    );
  }

  const actions = ["عرض التفاصيل", "تعديل", "نسخ", "اختبار", "تعطيل / تفعيل", "استيراد Rank لو التطبيق Keeta"];

  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1380px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {[
              "Rank Name",
              "Application",
              "Project",
              "Rank Type",
              "Minimum Orders",
              "On Time Rule",
              "Cancellation Rule",
              "Rejection Rule",
              "Working Hours Rule",
              "Level Output",
              "Status",
              "Actions",
            ].map((head) => (
              <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">{row.name}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.applicationName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.rankType}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.minimumOrders ?? "-"}</td>
              <td className="min-w-44 px-4 py-3">{row.onTimeRule}</td>
              <td className="min-w-44 px-4 py-3">{row.cancellationRule}</td>
              <td className="min-w-44 px-4 py-3">{row.rejectionRule}</td>
              <td className="min-w-44 px-4 py-3">{row.workingHoursRule}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge value={row.levelOutput} tone={row.levelOutput.includes("تحتاج") ? "amber" : "blue"} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge value={row.status} tone={row.status === "نشط" ? "emerald" : "slate"} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => onAction(action, row)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                    >
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
