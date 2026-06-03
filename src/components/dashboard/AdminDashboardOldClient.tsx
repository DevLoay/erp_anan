"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AdminDashboardOldData, DashboardListRow } from "@/lib/dashboard/getAdminDashboardOldData";

type Props = {
  data: AdminDashboardOldData;
};

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function ActionButton({ children, tone = "white", onClick }: { children: ReactNode; tone?: "white" | "blue" | "green" | "amber" | "red"; onClick: () => void }) {
  const klass = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`h-10 rounded-xl border px-4 text-sm font-black shadow-sm ${klass}`}>
      {children}
    </button>
  );
}

function SummaryCard({ title, value, sub, icon }: { title: string; value: string | number; sub?: string; icon?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm">
      <p className="text-xs font-black text-slate-500">{icon ? `${icon} ` : ""}{title}</p>
      <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
      {sub ? <p className="mt-1 text-xs font-bold text-slate-500">{sub}</p> : null}
    </div>
  );
}

function KpiBadge({ value }: { value: number }) {
  const klass = value >= 80 ? "bg-emerald-100 text-emerald-800" : value >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${klass}`}>{pct(value)}</span>;
}

function ListCard({ title, rows, onDetails }: { title: string; rows: DashboardListRow[]; onDetails: () => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={onDetails} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm">
          تفاصيل
        </button>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-right text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs font-black text-slate-600">
                <th className="rounded-r-xl px-3 py-2">الاسم</th>
                <th className="px-3 py-2">KPI</th>
                <th className="px-3 py-2">قيمة</th>
                <th className="rounded-l-xl px-3 py-2">تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="border-b border-slate-100 px-3 py-2 font-black text-slate-950">{row.name}</td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <KpiBadge value={row.kpi} />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 font-bold text-slate-800">{fmt(row.value)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-500">{row.subtitle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
          لا توجد بيانات كافية لإظهار هذه القائمة حالياً.
        </div>
      )}
    </section>
  );
}

function buildCsv(data: AdminDashboardOldData) {
  const sections = [
    ["Best Drivers", ...data.lists.bestDrivers],
    ["Best Supervisors", ...data.lists.bestSupervisors],
    ["Best Cities", ...data.lists.bestCities],
    ["Best Projects", ...data.lists.bestProjects],
  ];
  const lines = ["section,name,kpi,value,subtitle"];
  for (const section of sections) {
    const [title, ...rows] = section as [string, ...DashboardListRow[]];
    for (const row of rows) {
      lines.push([title, row.name, row.kpi, row.value, row.subtitle].map((item) => `"${String(item).replaceAll('"', '""')}"`).join(","));
    }
  }
  return lines.join("\n");
}

export function AdminDashboardOldClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const csv = useMemo(() => buildCsv(data), [data]);

  const printPage = () => window.print();
  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-dashboard.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (data.databaseStatus === "offline") {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-right" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-red-700">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{data.databaseMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-right" dir="rtl" suppressHydrationWarning>
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <header className="mb-4 flex items-start justify-between border-b border-slate-200 pb-4">
        <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
          رجوع
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-950">لوحة الإدارة</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">لوحة تشغيل حقيقية من بيانات المناديب والمدن والمشاريع والتنبيهات.</p>
        </div>
      </header>

      <section className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={printPage}>طباعة / بي دي إف</ActionButton>
            <ActionButton tone="amber" onClick={downloadCsv}>تصدير إكسل</ActionButton>
            <ActionButton tone="red" onClick={() => setToast("الحذف من لوحة الإدارة غير مباشر. افتح القسم المطلوب ثم احذف السجل المحدد.")}>حذف</ActionButton>
            <ActionButton onClick={() => router.push("/drivers")}>تعديل</ActionButton>
            <ActionButton tone="blue" onClick={() => router.push("/imports")}>استيراد Excel / PDF</ActionButton>
            <ActionButton tone="green" onClick={() => router.push("/drivers")}>+ إضافة</ActionButton>
          </div>
          <form className="grid min-w-[520px] flex-1 grid-cols-1 gap-3 md:grid-cols-4" action="/dashboard">
            <label className="text-xs font-black text-slate-800">
              من تاريخ
              <input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black text-slate-800">
              إلى تاريخ
              <input name="toDate" type="date" defaultValue={data.filters.toDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black text-slate-800">
              بحث
              <input name="q" defaultValue={data.filters.q} placeholder="بحث مندوب / مدينة / مشروع..." className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm">تطبيق</button>
              <button type="button" onClick={() => router.push("/dashboard")} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800">عرض الكل</button>
            </div>
          </form>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton onClick={printPage}>Print / PDF</ActionButton>
        <ActionButton tone="green" onClick={downloadCsv}>Excel / CSV</ActionButton>
      </div>

      <section className="mb-3">
        <h2 className="mb-1 text-2xl font-black text-slate-950">لوحة الإدارة</h2>
        <p className="text-sm font-bold text-slate-500">ملخص إداري شامل، اضغط على أي كارت لعرض التفاصيل وأفضل 5 جهات.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="إجمالي المناديب" value={fmt(data.summary.totalDrivers)} icon="🏍️" />
        <SummaryCard title="المناديب النشطين" value={fmt(data.summary.activeDrivers)} icon="🟢" />
        <SummaryCard title="إجمالي الطلبات" value={fmt(data.summary.totalOrders)} icon="📦" />
        <SummaryCard title="متوسط KPI" value={pct(data.summary.averageKpi)} icon="📊" />
        <SummaryCard title="عدد المشرفين" value={fmt(data.summary.supervisors)} icon="👥" />
        <SummaryCard title="محتاجون متابعة" value={fmt(data.summary.needsFollowUp)} icon="⚠️" />
        <SummaryCard title="أفضل مدينة" value={data.summary.bestCity.name} sub={pct(data.summary.bestCity.kpi)} icon="🏙️" />
        <SummaryCard title="أفضل مندوب" value={data.summary.bestDriver.name} sub={pct(data.summary.bestDriver.kpi)} icon="🏍️" />
        <SummaryCard title="أفضل مشروع" value={data.summary.bestProject.name} sub={pct(data.summary.bestProject.kpi)} icon="📌" />
        <SummaryCard title="أفضل مشرف" value={data.summary.bestSupervisor.name} sub={pct(data.summary.bestSupervisor.kpi)} icon="🧑‍💼" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <ListCard title="أفضل المناديب بالتقرير" rows={data.lists.bestDrivers} onDetails={() => router.push("/drivers")} />
        <ListCard title="أفضل المشرفين بالتقرير" rows={data.lists.bestSupervisors} onDetails={() => router.push("/supervisors")} />
        <ListCard title="أفضل المدن بالتقرير" rows={data.lists.bestCities} onDetails={() => router.push("/city-ranking")} />
        <ListCard title="أفضل المشاريع بالتقرير" rows={data.lists.bestProjects} onDetails={() => router.push("/projects")} />
      </section>
    </main>
  );
}
