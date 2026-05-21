import Link from "next/link";
import { ImportBatchDetails } from "@/components/imports/ImportBatchDetails";
import { getImportBatchDetails } from "@/lib/imports/importHistory";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImportBatchDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getImportBatchDetails(id);
  return (
    <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/imports/history" className="hover:text-slate-950">تاريخ الاستيراد</Link>
            <span>/</span>
            <span className="text-slate-800">تفاصيل الدفعة</span>
          </nav>
          <h1 className="text-3xl font-black text-slate-950">تفاصيل عملية الاستيراد</h1>
          <p className="mt-2 max-w-4xl text-sm font-bold text-slate-600">مراجعة بيانات الملف، القالب، الصفوف، الأخطاء ونتائج الربط.</p>
        </div>
        <Link href="/imports/history" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع للتاريخ</Link>
      </div>
      <ImportBatchDetails data={data} />
    </main>
  );
}

