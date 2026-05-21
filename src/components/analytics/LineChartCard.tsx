"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDatum } from "./types";

type LineChartCardProps = {
  title: string;
  data: ChartDatum[];
  dataKey?: string;
  loading?: boolean;
  emptyMessage?: string;
};

export function LineChartCard({ title, data, dataKey = "value", loading, emptyMessage }: LineChartCardProps) {
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
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey={dataKey} stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
