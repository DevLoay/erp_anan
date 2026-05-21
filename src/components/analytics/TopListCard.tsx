import Link from "next/link";
import type { TopListItem } from "./types";

type TopListCardProps = {
  title: string;
  items: TopListItem[];
  loading?: boolean;
  emptyMessage?: string;
};

export function TopListCard({ title, items, loading, emptyMessage }: TopListCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="mt-4 grid gap-2">
          {items.map((item, index) => {
            const content = (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">
                    <span className="ml-2 text-slate-400">#{index + 1}</span>
                    {item.label}
                  </p>
                  {item.sub ? <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{item.sub}</p> : null}
                </div>
                <strong className="text-sm font-black text-slate-950">{item.value}</strong>
              </div>
            );
            return item.href ? (
              <Link key={`${item.label}:${index}`} href={item.href}>
                {content}
              </Link>
            ) : (
              <div key={`${item.label}:${index}`}>{content}</div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
          {emptyMessage ?? "لا توجد بيانات كافية لإظهار هذه القائمة."}
        </p>
      )}
    </div>
  );
}
