type Props = {
  nextPath: string;
  errorMessage?: string;
};

export function LoginClient({ nextPath, errorMessage }: Props) {
  return (
    <section className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
      <form
        action="/api/auth/login"
        method="post"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="nextPath" value={nextPath} />
        <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">تسجيل الدخول</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">ادخل بحسابك المسجل لفتح نظام التشغيل والماليات.</p>

        <div className="mt-6 grid gap-4">
          <label htmlFor="email" className="grid gap-2 text-sm font-bold text-slate-700">
            البريد الإلكتروني
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </label>
          <label htmlFor="password" className="grid gap-2 text-sm font-bold text-slate-700">
            كلمة المرور
            <input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </label>
        </div>

        {errorMessage ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{errorMessage}</div> : null}

        <button
          type="submit"
          className="mt-5 h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
        >
          دخول
        </button>
      </form>
    </section>
  );
}
