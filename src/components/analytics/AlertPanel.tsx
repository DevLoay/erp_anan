import Link from "next/link";
import type { SmartAlert } from "./types";

type AlertPanelProps = {
  title?: string;
  alerts: SmartAlert[];
  loading?: boolean;
};

const severityClass = {
  critical: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  good: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function AlertPanel({ title = "التنبيهات والتحليلات", alerts, loading }: AlertPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : alerts.length ? (
        <div className="mt-4 grid gap-2">
          {alerts.map((alert) => {
            const content = (
          <div className={`rounded-xl border p-2.5 ${severityClass[alert.severity]}`}>
                <strong className="block text-sm font-black">{alert.title}</strong>
                <p className="mt-1 text-xs font-semibold leading-6 opacity-80">{alert.body}</p>
              </div>
            );
            return alert.href ? (
              <Link key={`${alert.title}:${alert.body}`} href={alert.href}>
                {content}
              </Link>
            ) : (
              <div key={`${alert.title}:${alert.body}`}>{content}</div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد تنبيهات مبنية على البيانات الحالية.</p>
      )}
    </div>
  );
}
