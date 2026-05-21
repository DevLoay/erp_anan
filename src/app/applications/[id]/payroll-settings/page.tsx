import Link from "next/link";
import { PayrollSettingsClient } from "@/components/payroll/PayrollSettingsClient";
import { getPayrollSettingsData, resolvePayrollSettingFilters } from "@/lib/payroll/payrollSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationPayrollSettingsPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const filters = resolvePayrollSettingFilters({ ...query, applicationId: id });
  const data = await getPayrollSettingsData(filters);
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/applications" className="hover:text-slate-950">مركز التطبيقات</Link>
            <span>/</span>
            <span className="text-slate-800">إعدادات المسير</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">إعدادات مسير التطبيق</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">إعدادات المسير المرتبطة بهذا التطبيق.</p>
        </div>
        <Link href="/payroll/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">كل إعدادات المسير</Link>
      </div>
      <PayrollSettingsClient data={data} basePath={`/applications/${id}/payroll-settings`} scopeTitle="هذه الصفحة تعرض إعدادات المسير الخاصة بالتطبيق المحدد فقط." />
    </main>
  );
}

