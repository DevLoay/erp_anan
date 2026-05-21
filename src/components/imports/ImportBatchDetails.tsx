"use client";

import { useState } from "react";

type BatchDetails = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  batch: null | {
    id: string;
    fileName: string;
    fileType: string;
    applicationName: string;
    projectName: string;
    templateName: string;
    createdBy: string;
    createdAt: string;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    missingDrivers: number;
    unlinkedAccounts: number;
    rows: {
      id: string;
      rowNumber: number;
      status: string;
      isValid: boolean;
      driver: string;
      applicationAccount: string;
      vehicle: string;
      rawData: unknown;
      mappedData: unknown;
      errorType: string;
      errorMessage: string;
    }[];
  };
};

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
    </div>
  );
}

export function ImportBatchDetails({ data }: { data: BatchDetails }) {
  const [modal, setModal] = useState<{ title: string; body: unknown } | null>(null);
  const batch = data.batch;

  if (data.databaseStatus === "offline") return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-800">{data.databaseMessage}</div>;
  if (!batch) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-600">عملية الاستيراد غير موجودة.</div>;

  return (
    <section className="space-y-5" dir="rtl">
      {modal ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-950">{modal.title}</h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-3 py-1 text-sm font-black">
                إغلاق
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-left text-xs text-slate-50" dir="ltr">
              {JSON.stringify(modal.body, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-black text-slate-500">الملف</p>
            <h2 className="text-xl font-black text-slate-950">{batch.fileName}</h2>
          </div>
          <div>
            <p className="text-xs font-black text-slate-500">القالب</p>
            <p className="font-bold text-slate-800">{batch.templateName}</p>
          </div>
          <div>
            <p className="text-xs font-black text-slate-500">الحالة</p>
            <p className="font-bold text-slate-800">{batch.status}</p>
          </div>
          <div>التطبيق: {batch.applicationName}</div>
          <div>المشروع: {batch.projectName}</div>
          <div>بواسطة: {batch.createdBy}</div>
          <div>التاريخ: {batch.createdAt}</div>
          <div>نوع الملف: {batch.fileType}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Total Rows" value={batch.totalRows} />
        <MetricCard title="Valid Rows" value={batch.validRows} />
        <MetricCard title="Invalid Rows" value={batch.invalidRows} />
        <MetricCard title="Duplicates" value={batch.duplicateRows} />
        <MetricCard title="Missing Drivers" value={batch.missingDrivers} />
        <MetricCard title="Unlinked Accounts" value={batch.unlinkedAccounts} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {["Row", "Status", "Driver", "Vehicle", "Application Account", "Error Type", "Error Message", "Actions"].map((head) => (
                <th key={head} className="whitespace-nowrap px-4 py-3">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batch.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-black">{row.rowNumber}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.driver}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.vehicle}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.applicationAccount}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.errorType}</td>
                <td className="min-w-72 px-4 py-3 text-xs font-bold text-slate-600">{row.errorMessage}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setModal({ title: "Raw Data", body: row.rawData })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      Raw Data
                    </button>
                    <button type="button" onClick={() => setModal({ title: "Mapped Data", body: row.mappedData })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      Mapped Data
                    </button>
                    <button type="button" onClick={() => setModal({ title: "قيد التطوير", body: "الربط اليدوي وإعادة التحقق سيتم استكمالهم في مرحلة لاحقة." })} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">
                      ربط / إعادة تحقق
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
