"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartDatum } from "./types";

type PieChartCardProps = {
  title: string;
  data: ChartDatum[];
  loading?: boolean;
  emptyMessage?: string;
};

const colors = ["#10b981", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

export function PieChartCard({ title, data, loading, emptyMessage }: PieChartCardProps) {
  const empty = !loading && data.length === 0;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      {loading ? (
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-slate-100" />
      ) : empty ? (
        <div className="mt-4 flex h-56 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-400">
          {emptyMessage ?? "لا توجد بيانات كافية للرسم."}
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="h-48 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid content-center gap-2">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />
                  {entry.name}
                </span>
                <span className="text-slate-950">{entry.value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
