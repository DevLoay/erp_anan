import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <section className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-right shadow-sm">
        <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">استعادة كلمة المرور</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-600">
          إعادة كلمة المرور تتم من الأدمن عبر صفحة إدارة المستخدمين حتى يتم تفعيل إرسال البريد الإلكتروني.
        </p>
        <Link href="/login" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
          رجوع لتسجيل الدخول
        </Link>
      </div>
    </section>
  );
}

