import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessDeniedPage({ searchParams }: PageProps) {
  const from = String((await searchParams).from ?? "");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
      <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-7 text-right shadow-sm">
        <p className="text-sm font-black text-amber-700">صلاحيات غير كافية</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">لا يمكنك فتح هذه الصفحة</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
          تم تسجيل دخولك بنجاح، لكن هذه الصفحة ليست ضمن صلاحيات حسابك. ارجع إلى لوحة الإدارة أو سجل الخروج بحساب آخر.
        </p>
        {from ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500" dir="ltr">{from}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard" className="inline-flex rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
            لوحة الإدارة
          </Link>
          <Link href="/logout" className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
            تسجيل الخروج
          </Link>
        </div>
      </section>
    </main>
  );
}
