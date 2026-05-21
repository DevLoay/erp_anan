type StatCardProps = {
  label: string;
  value: string | number;
  hint: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
      <p className="mt-2 text-xs font-semibold text-slate-500">{hint}</p>
    </div>
  );
}
