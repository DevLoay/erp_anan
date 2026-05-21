import type { AnalyticsTone } from "./types";

type PerformanceGaugeProps = {
  title: string;
  value: number;
  target?: number;
  label?: string;
  loading?: boolean;
  empty?: boolean;
};

function tone(value: number, target = 100): AnalyticsTone {
  const pct = target ? (value / target) * 100 : value;
  if (pct >= 100) return "emerald";
  if (pct >= 80) return "amber";
  return "red";
}

const fillClass: Record<AnalyticsTone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
  blue: "bg-blue-500",
  slate: "bg-slate-500",
};

export function PerformanceGauge({ title, value, target = 100, label, loading, empty }: PerformanceGaugeProps) {
  const percentage = Math.max(0, Math.min(100, target ? (value / target) * 100 : value));
  const currentTone = tone(value, target);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100" />
      ) : empty ? (
        <p className="mt-4 text-sm font-bold text-slate-400">لا توجد بيانات كافية لإظهار المؤشر.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <strong className="text-2xl font-black text-slate-950">{Math.round(value)}%</strong>
            <span className="text-xs font-bold text-slate-500">{label ?? `الهدف ${target}%`}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${fillClass[currentTone]}`} style={{ width: `${percentage}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
