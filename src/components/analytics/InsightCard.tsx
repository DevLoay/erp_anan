import type { Insight } from "./types";

type InsightCardProps = {
  insight?: Insight;
  loading?: boolean;
};

const toneClass = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  orange: "border-orange-200 bg-orange-50 text-orange-900",
  red: "border-red-200 bg-red-50 text-red-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  slate: "border-slate-200 bg-white text-slate-900",
};

export function InsightCard({ insight, loading }: InsightCardProps) {
  const tone = insight?.tone ?? "slate";
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-black opacity-70">تحليل ذكي</p>
      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        </div>
      ) : insight ? (
        <>
          <h3 className="mt-1 text-base font-black">{insight.title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 opacity-80">{insight.body}</p>
        </>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-7 opacity-70">لا توجد بيانات كافية لإظهار تحليل دقيق حاليا.</p>
      )}
    </div>
  );
}
