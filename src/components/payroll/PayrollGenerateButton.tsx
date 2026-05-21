"use client";

import { useState } from "react";
import type { ReportFilters } from "@/lib/reporting";

type GenerateResult = {
  month: string;
  created: number;
  updated: number;
  skippedLocked: number;
  skippedNoDriver: number;
  totalNet: number;
  message?: string;
};

export function PayrollGenerateButton({ filters }: { filters: ReportFilters }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");

  async function generatePayroll() {
    const ok = window.confirm("سيتم توليد أو تحديث مسودات المسير فقط. المسيرات المعتمدة أو المقفلة لن يتم تعديلها.");
    if (!ok) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const payload = (await res.json()) as { data?: GenerateResult; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "تعذر توليد المسير");
      setResult(payload.data ?? null);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر توليد المسير");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-black text-emerald-950">توليد مسير من KPI</h3>
          <p className="mt-1 text-sm font-semibold text-emerald-800">
            يحسب الأساسي، مكافأة التارجت، الطلبات الإضافية، السلف، الخصومات، السيارة والسكن، ويحفظها كمسودة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generatePayroll()}
          disabled={loading}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جاري التوليد..." : "توليد مسير الشهر"}
        </button>
      </div>

      {result ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-white p-3 text-sm font-bold text-emerald-900">
          {result.message ??
            `تم إنشاء ${result.created} سجل وتحديث ${result.updated} سجل. تم تخطي ${result.skippedLocked} سجل معتمد/مقفل.`}
        </div>
      ) : null}
      {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
    </div>
  );
}
