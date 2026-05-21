import Link from "next/link";
import { PayrollSettingsClient } from "@/components/payroll/PayrollSettingsClient";
import { getPayrollSettingsData, resolvePayrollSettingFilters } from "@/lib/payroll/payrollSettings";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayrollSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getPayrollSettingsData(resolvePayrollSettingFilters(params));
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/payroll" className="hover:text-slate-950">مسير الرواتب</Link>
            <span>/</span>
            <span className="text-slate-800">إعدادات المسير</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">إعدادات مسير الرواتب</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">
            إعداد قواعد الرواتب والبونص والخصومات لكل تطبيق ومشروع.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/applications" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">مركز التطبيقات</Link>
          <Link href="/settings/payroll" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">إعدادات البرنامج</Link>
        </div>
      </div>
      <PayrollSettingsClient data={data} />
    </main>
  );
}

