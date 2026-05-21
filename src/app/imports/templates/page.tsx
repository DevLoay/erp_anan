import Link from "next/link";
import { ImportTemplatesClient } from "@/components/imports/ImportTemplatesClient";
import { getImportTemplatesData, resolveImportTemplateFilters } from "@/lib/imports/templates";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImportTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getImportTemplatesData(resolveImportTemplateFilters(params));
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/imports" className="hover:text-slate-950">الاستيراد</Link>
            <span>/</span>
            <span className="text-slate-800">قوالب الاستيراد</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">قوالب الاستيراد</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">
            إدارة قوالب رفع الملفات وربط الأعمدة لكل التطبيقات والبيانات التشغيلية.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/imports" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">رفع ملف</Link>
          <Link href="/imports/history" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">تاريخ الاستيراد</Link>
        </div>
      </div>
      <ImportTemplatesClient data={data} />
    </main>
  );
}

