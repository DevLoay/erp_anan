type StatusBadgeProps = {
  value: string;
};

const labels: Record<string, string> = {
  GOOD: "جيد",
  WARNING: "تحذير",
  CRITICAL: "حرج",
  EXCELLENT: "ممتاز",
  AT_RISK: "معرض للخطر",
  WEAK: "ضعيف",
  valid: "مؤهل",
  invalid: "غير مؤهل",
};

function classes(value: string) {
  if (["GOOD", "EXCELLENT", "valid"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["WARNING", "AT_RISK"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["CRITICAL", "WEAK", "invalid"].includes(value)) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function StatusBadge({ value }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes(value)}`}>{labels[value] ?? value}</span>;
}
