import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { inspectSessionToken, SESSION_COOKIE, type SessionInspection } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function internalPath(value: unknown) {
  const path = String(value ?? "/dashboard").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export default async function AuthCheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = internalPath(params.next);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const inspection: SessionInspection = await inspectSessionToken(token).catch(() => ({ ok: false, reason: "payload_parse_error" }));

  if (inspection.ok) {
    redirect(next);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6" dir="rtl">
      <section className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">تعذر تثبيت جلسة الدخول</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
          تم إرسال بيانات الدخول، لكن الطلب التالي لم يحمل جلسة صالحة. هذه الصفحة تساعدنا نحدد سبب الرجوع المتكرر إلى تسجيل الدخول.
        </p>

        <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">كوكي الجلسة موجودة</dt>
            <dd className="text-slate-950">{token ? "نعم" : "لا"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">سبب الرفض</dt>
            <dd className="font-black text-red-700">{inspection.reason ?? "غير معروف"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">المسار المطلوب</dt>
            <dd dir="ltr" className="text-slate-950">{next}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/login" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">
            العودة لتسجيل الدخول
          </Link>
          <Link href="/api/auth/debug" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">
            فحص الجلسة
          </Link>
        </div>
      </section>
    </main>
  );
}
