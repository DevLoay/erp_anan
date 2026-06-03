"use client";

import { useState } from "react";

type ReviewRow = {
  id: string;
  appName: string;
  appUserId: string | null;
  appUsername: string | null;
  username: string;
  applicationName: string;
  applicationProjectName: string;
  cityName: string;
  driverName: string;
  needsReview: boolean;
  unmatchedReason: string | null;
  status: string;
};

export function ApplicationAccountReviewClient({ rows }: { rows: ReviewRow[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function runCleanup(dryRun = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/application-accounts/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تشغيل الإصلاح.");
      setMessage(
        dryRun
          ? `معاينة الإصلاح: ${payload.data.beforeNeedsLinking} حساب يحتاج ربط.`
          : `تم الإصلاح: قبل ${payload.data.beforeNeedsLinking} / بعد ${payload.data.afterNeedsLinking}.`,
      );
      if (!dryRun) window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تشغيل الإصلاح.");
    } finally {
      setBusy(false);
    }
  }

  function todo(action: string) {
    setMessage(`${action}: استخدم الإصلاح التلقائي الآن، والربط اليدوي التفصيلي سيتم من نفس الشاشة في المرحلة التالية.`);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">مراجعة ربط حسابات التطبيقات</h2>
            <p className="text-sm text-slate-500">الحسابات التي ينقصها مشروع تشغيل أو مدينة أو مندوب داخلي.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => runCleanup(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black">معاينة الإصلاح</button>
            <button disabled={busy} onClick={() => runCleanup(false)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">إصلاح تلقائي</button>
          </div>
        </div>
        {message ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{message}</div> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["التطبيق", "App User ID", "اسم الحساب", "Application", "مشروع التشغيل", "المدينة", "المندوب", "سبب المراجعة", "الحالة", "إجراءات"].map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3 text-right font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.appName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.appUserId || row.username}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.appUsername || row.username}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationProjectName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.cityName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.driverName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-rose-700">{row.unmatchedReason || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.needsReview ? "تحتاج مراجعة" : row.status}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => todo("ربط بمندوب")} className="rounded-lg border border-slate-200 px-3 py-1 font-bold">ربط بمندوب</button>
                      <button onClick={() => todo("ربط بمشروع")} className="rounded-lg border border-slate-200 px-3 py-1 font-bold">ربط بمشروع</button>
                      <button onClick={() => todo("ربط بمدينة")} className="rounded-lg border border-slate-200 px-3 py-1 font-bold">ربط بمدينة</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-500">لا توجد حسابات تحتاج مراجعة حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
