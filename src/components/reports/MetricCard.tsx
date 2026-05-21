type MetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "sky" | "emerald" | "amber" | "red";
};

const tones = {
  slate: "border-slate-200 bg-white text-slate-950",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
};

export function MetricCard({ label, value, hint, tone = "slate" }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-black opacity-70">{label}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
      {hint ? <p className="mt-1 text-xs font-bold opacity-70">{hint}</p> : null}
    </div>
  );
}
