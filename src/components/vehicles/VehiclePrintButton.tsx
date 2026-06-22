"use client";

export function VehiclePrintButton() {
  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={() => window.print()}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
    >
      طباعة الملف
    </button>
  );
}
