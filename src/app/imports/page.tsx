import Link from "next/link";
import { ImportStepper } from "@/components/imports/ImportStepper";
import { getImportTemplatesData, resolveImportTemplateFilters } from "@/lib/imports/templates";

export const dynamic = "force-dynamic";

function Header() {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between" dir="rtl">
      <div>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
          <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
          <span>/</span>
          <span className="text-slate-800">الاستيراد</span>
        </nav>
        <h1 className="text-3xl font-black text-slate-950">نظام الاستيراد</h1>
        <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">
          رفع الملفات، مطابقة الأعمدة، المعاينة والتحقق، ثم اعتماد الحفظ بدون كتابة أي بيانات قبل Preview.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/imports/templates" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800">قوالب الاستيراد</Link>
        <Link href="/imports/history" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">تاريخ الاستيراد</Link>
        <Link href="/applications/imports" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">استيراد التطبيقات</Link>
      </div>
    </div>
  );
}

export default async function ImportsPage() {
  const data = await getImportTemplatesData(resolveImportTemplateFilters({}));
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4">
      <Header />
      <ImportStepper templates={data.rows} applications={data.applications} projects={data.projects} />
    </main>
  );
}

