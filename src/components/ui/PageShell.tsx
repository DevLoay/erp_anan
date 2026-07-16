import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <section className="space-y-4" suppressHydrationWarning>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="transition hover:text-slate-950">
              الرئيسية
            </Link>
            <span>/</span>
            <span className="text-slate-800">{title}</span>
          </nav>
          <h1 className="text-2xl font-black text-slate-950">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
            لوحة الإدارة
          </Link>
          <Link href="/management-reports" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 shadow-sm transition hover:bg-blue-100">
            التقارير
          </Link>
          <Link href="/imports" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100">
            الاستيراد
          </Link>
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}
