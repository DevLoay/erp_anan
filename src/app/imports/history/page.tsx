import Link from "next/link";
import { ImportHistoryClient } from "@/components/imports/ImportHistoryClient";
import { getImportHistoryData } from "@/lib/imports/importHistory";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage() {
  const data = await getImportHistoryData();
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/imports" className="hover:text-slate-950">الاستيراد</Link>
            <span>/</span>
            <span className="text-slate-800">تاريخ الاستيراد</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">تاريخ الاستيراد</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">متابعة كل Import Batches والصفوف الصحيحة والخاطئة وحالة الاعتماد.</p>
        </div>
        <Link href="/imports" className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white">استيراد ملف جديد</Link>
      </div>
      <ImportHistoryClient data={data} />
    </main>
  );
}

