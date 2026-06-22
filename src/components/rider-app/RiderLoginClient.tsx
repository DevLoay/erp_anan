"use client";

import { useState, type FormEvent } from "react";

export function RiderLoginClient({ nextPath }: { nextPath: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rider/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تسجيل الدخول.");
      window.location.href = nextPath || "/rider-app/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">دخول المندوب</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">ادخل برقم الجوال أو كود المندوب أو الحساب المربوط.</p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            رقم الجوال / كود المندوب / الحساب
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            كلمة المرور
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoComplete="current-password"
              required
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-800">
          لو مفيش حساب مستخدم للمندوب، استخدم آخر 4 أرقام من الجوال أو رقم الهوية ككلمة مرور مؤقتة.
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">{error}</div> : null}

        <button type="submit" disabled={loading} className="mt-5 h-12 w-full rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60">
          {loading ? "جاري الدخول..." : "دخول"}
        </button>

        <a href="/login" className="mt-4 block text-center text-xs font-black text-slate-500">دخول الإدارة</a>
      </form>
    </section>
  );
}
