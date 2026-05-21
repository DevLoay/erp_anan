type ProgressTargetCardProps = {
  title: string;
  current: number;
  target: number;
  suffix?: string;
  loading?: boolean;
  empty?: boolean;
};

function colorClass(achievement: number) {
  if (achievement >= 100) return "bg-emerald-500 text-emerald-700";
  if (achievement >= 80) return "bg-amber-500 text-amber-700";
  return "bg-red-500 text-red-700";
}

export function ProgressTargetCard({ title, current, target, suffix = "", loading, empty }: ProgressTargetCardProps) {
  const achievement = target ? Math.round((current / target) * 1000) / 10 : 0;
  const color = colorClass(achievement);
  const fill = color.split(" ")[0];
  const text = color.split(" ")[1];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100" />
      ) : empty || !target ? (
        <p className="mt-4 text-sm font-bold text-slate-400">لا يوجد تارجت محفوظ لهذا المؤشر.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <strong className={`text-xl font-black ${text}`}>{achievement}%</strong>
            <span className="text-xs font-bold text-slate-500">
              {current} / {target} {suffix}
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(achievement, 100)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
