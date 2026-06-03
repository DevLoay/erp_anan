import Link from "next/link";
import { ImportTemplatesClient } from "@/components/imports/ImportTemplatesClient";
import { getImportTemplatesData, resolveImportTemplateFilters } from "@/lib/imports/templates";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExcelColumnMappingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getImportTemplatesData(resolveImportTemplateFilters(params));
  const mappedRows = data.rows.filter((row) => row.columnMapping.length || row.requiredColumns.length || row.optionalColumns.length);
  const pageData = { ...data, rows: mappedRows.length ? mappedRows : data.rows };

  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/imports" className="hover:text-slate-950">الاستيراد</Link>
            <span>/</span>
            <span className="text-slate-800">ربط أعمدة Excel</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">ربط أعمدة Excel</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold leading-7 text-slate-600">
            إدارة ربط أعمدة الملفات مع حقول النظام قبل المعاينة والاعتماد. هذه الصفحة تستخدم نفس قوالب الاستيراد المحفوظة في PostgreSQL ولا تحفظ أي ملف قبل Preview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/imports/preview" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">رفع ملف</Link>
          <Link href="/imports/templates" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 shadow-sm hover:bg-amber-100">قوالب الاستيراد</Link>
          <Link href="/imports/history" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">تاريخ الاستيراد</Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">إجمالي القوالب</p>
          <strong className="mt-1 block text-2xl font-black text-slate-950">{data.rows.length}</strong>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
          <p className="text-xs font-black opacity-75">قوالب بها Mapping</p>
          <strong className="mt-1 block text-2xl font-black">{mappedRows.length}</strong>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800 shadow-sm">
          <p className="text-xs font-black opacity-75">مصدر البيانات</p>
          <strong className="mt-1 block text-2xl font-black">PostgreSQL</strong>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
          <p className="text-xs font-black opacity-75">الحفظ الآمن</p>
          <strong className="mt-1 block text-2xl font-black">Preview أولًا</strong>
        </div>
      </section>

      <ImportTemplatesClient data={pageData} basePath="/excel-column-mapping" />
    </main>
  );
}
