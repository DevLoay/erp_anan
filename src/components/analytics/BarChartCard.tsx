"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDatum } from "./types";

type BarChartCardProps = {
  title: string;
  data: ChartDatum[];
  dataKey?: string;
  loading?: boolean;
  emptyMessage?: string;
};

export function BarChartCard({ title, data, dataKey = "value", loading, emptyMessage }: BarChartCardProps) {
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
        <div className="mt-4 h-56 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} height={55} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey={dataKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
