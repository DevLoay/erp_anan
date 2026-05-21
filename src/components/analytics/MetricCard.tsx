import type { AnalyticsTone } from "./types";

type MetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  tone?: AnalyticsTone;
  loading?: boolean;
  empty?: boolean;
};

const toneClass: Record<AnalyticsTone, string> = {
  emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  orange: "text-orange-700 bg-orange-50 border-orange-200",
  red: "text-red-700 bg-red-50 border-red-200",
  rose: "text-rose-700 bg-rose-50 border-rose-200",
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  slate: "text-slate-900 bg-white border-slate-200",
};

export function MetricCard({ title, value, hint, tone = "slate", loading = false, empty = false }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded-md bg-slate-200" />
      ) : empty ? (
        <strong className="mt-2 block text-sm font-black opacity-60">لا توجد بيانات</strong>
      ) : (
        <strong className="mt-1 block text-xl font-black">{value}</strong>
      )}
      {hint ? <p className="mt-1 text-xs font-bold opacity-70">{hint}</p> : null}
    </div>
  );
}
