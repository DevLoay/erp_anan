import type { AnalyticsTone } from "./types";

type TrendCardProps = {
  title: string;
  value: string | number;
  change?: string | number;
  description?: string;
  tone?: AnalyticsTone;
  loading?: boolean;
  empty?: boolean;
};

const toneClass: Record<AnalyticsTone, string> = {
  emerald: "text-emerald-700 bg-emerald-50",
  amber: "text-amber-700 bg-amber-50",
  orange: "text-orange-700 bg-orange-50",
  red: "text-red-700 bg-red-50",
  rose: "text-rose-700 bg-rose-50",
  blue: "text-blue-700 bg-blue-50",
  slate: "text-slate-700 bg-slate-50",
};

export function TrendCard({ title, value, change, description, tone = "slate", loading, empty }: TrendCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-24 animate-pulse rounded-md bg-slate-200" />
          ) : empty ? (
            <strong className="mt-2 block text-sm font-black text-slate-400">لا توجد بيانات</strong>
          ) : (
            <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
          )}
        </div>
        {change !== undefined ? <span className={`rounded-full px-3 py-1 text-xs font-black ${toneClass[tone]}`}>{change}</span> : null}
      </div>
      {description ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}
