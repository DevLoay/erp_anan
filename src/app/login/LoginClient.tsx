"use client";

import { useState, type FormEvent } from "react";

export function LoginClient({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nextPath }),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تسجيل الدخول.");
      window.location.href = payload.redirectTo || "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">تسجيل الدخول</h1>
        <p className="mt-1 text-sm font-bold text-slate-500">ادخل بحسابك المسجل لفتح نظام التشغيل والماليات.</p>

        <div className="mt-6 grid gap-4">
          <label htmlFor="email" className="grid gap-2 text-sm font-bold text-slate-700">
            البريد الإلكتروني
            <input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </label>
          <label htmlFor="password" className="grid gap-2 text-sm font-bold text-slate-700">
            كلمة المرور
            <input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </section>
  );
}
