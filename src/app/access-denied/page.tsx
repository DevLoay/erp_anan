import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-right shadow-sm" dir="rtl">
      <p className="text-sm font-black text-red-700">صلاحيات غير كافية</p>
      <h1 className="mt-2 text-2xl font-black text-slate-950">لا يمكنك فتح هذه الصفحة</h1>
      <p className="mt-2 text-sm font-bold leading-7 text-slate-600">الصفحة محمية حسب الدور الحالي. اطلب من الأدمن تعديل الصلاحية أو افتح صفحة مناسبة لدورك.</p>
      <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
        العودة للوحة الإدارة
      </Link>
    </section>
  );
}

