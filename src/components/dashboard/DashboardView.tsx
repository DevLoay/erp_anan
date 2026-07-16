import Link from "next/link";
import { StatCard } from "./StatCard";
import { getDashboardStats } from "@/lib/stats";

const quickActions = [
  { href: "/management-reports", label: "فتح التقارير", className: "bg-slate-950 text-white border-slate-950" },
  { href: "/cities", label: "متابعة المدن", className: "bg-sky-50 text-sky-800 border-sky-200" },
  { href: "/notifications", label: "تنبيهات التشغيل", className: "bg-amber-50 text-amber-800 border-amber-200" },
  { href: "/payroll", label: "مسير الرواتب", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
];

export async function DashboardView() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-5">
      {!stats.databaseReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          قاعدة البيانات لم تتصل بعد. شغل PostgreSQL ثم نفذ Prisma migration. التفاصيل: {stats.error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`rounded-lg border p-4 text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${action.className}`}
          >
            {action.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي المناديب" value={stats.drivers} hint="من جدول Driver" />
        <StatCard label="مناديب نشطين" value={stats.activeDrivers} hint="Driver.status = ACTIVE" />
        <StatCard label="المشرفين" value={stats.supervisors} hint="من جدول Supervisor" />
        <StatCard label="المدن" value={stats.cities} hint="من جدول City" />
        <StatCard label="السيارات" value={stats.vehicles} hint="من جدول Vehicle" />
        <StatCard label="الطلبات" value={stats.orders} hint="مجموع DailyReport.orders" />
        <StatCard label="ساعات العمل" value={stats.workingHours} hint="مجموع DailyReport.workingHours" />
        <StatCard label="صافي الرواتب" value={stats.payrollNet} hint="مجموع Payroll.netSalary" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-black text-slate-950">ملخص التنبيهات</h3>
          <p className="mt-2 text-3xl font-black text-amber-700">{stats.alerts}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">تنبيهات غير مغلقة من قاعدة البيانات.</p>
          <Link href="/notifications" className="mt-4 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-black text-white">
            عرض التنبيهات
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="text-base font-black text-slate-950">تدفق التشغيل المتصل</h3>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            {["Imports", "Uploaded Reports", "Daily Reports", "KPI", "Alerts", "Tasks", "Payroll", "Reports"].map((step) => (
              <span key={step} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
