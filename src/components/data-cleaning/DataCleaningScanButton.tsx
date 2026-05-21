"use client";

import { useState } from "react";

type ScanResult = {
  scannedIssues: number;
  created: number;
  existing: number;
  counts: Record<string, number>;
};

export function DataCleaningScanButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function scan() {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/data-cleaning/scan", { method: "POST" });
      const payload = (await res.json()) as { data?: ScanResult; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "تعذر فحص البيانات");
      setResult(payload.data ?? null);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر فحص البيانات");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-black text-sky-950">فحص تنظيف البيانات</h3>
          <p className="mt-1 text-sm font-semibold text-sky-800">
            يفحص التكرارات والروابط الناقصة بدون حذف أو تعديل أي بيانات أصلية، ثم يسجل المشاكل للمراجعة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جاري الفحص..." : "فحص البيانات الآن"}
        </button>
      </div>

      {result ? (
        <div className="mt-3 rounded-md border border-sky-200 bg-white p-3 text-sm font-bold text-sky-900">
          تم فحص {result.scannedIssues} مشكلة محتملة. جديد: {result.created}، موجود سابقا: {result.existing}.
        </div>
      ) : null}
      {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
    </div>
  );
}
