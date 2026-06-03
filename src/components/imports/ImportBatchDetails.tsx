"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type BatchDetails = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  drivers: { id: string; label: string; searchText: string }[];
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

type BatchRow = NonNullable<BatchDetails["batch"]>["rows"][number];

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-2xl font-black text-slate-950">{value}</strong>
    </div>
  );
}

export function ImportBatchDetails({ data }: { data: BatchDetails }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ title: string; body: unknown } | null>(null);
  const [linkRow, setLinkRow] = useState<BatchRow | null>(null);
  const [driverQuery, setDriverQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const batch = data.batch;
  const driverOptions = useMemo(() => {
    const query = driverQuery.trim().toLowerCase();
    if (!query) return data.drivers.slice(0, 80);
    return data.drivers.filter((driver) => driver.searchText.includes(query) || driver.label.toLowerCase().includes(query)).slice(0, 80);
  }, [data.drivers, driverQuery]);

  async function revalidateBatch() {
    if (!batch) return;
    const res = await fetch(`/api/imports/history/${batch.id}/revalidate`, { method: "POST" });
    const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    setModal({ title: "نتيجة إعادة التحقق", body: payload.message ?? payload.error ?? "تم إرسال طلب إعادة التحقق." });
    router.refresh();
  }

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || !linkRow) return;
    const form = new FormData(event.currentTarget);
    const driverId = String(form.get("driverId") || "");
    if (!driverId) {
      setModal({ title: "بيانات ناقصة", body: "اختر المندوب الصحيح قبل تنفيذ الربط." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/imports/history/${batch.id}/rows/${linkRow.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || "تعذر ربط الصف بالمندوب.");
      setLinkRow(null);
      setDriverQuery("");
      setModal({ title: "تم الربط", body: payload.message ?? "تم ربط الصف بالمندوب." });
      router.refresh();
    } catch (error) {
      setModal({ title: "تعذر الربط", body: error instanceof Error ? error.message : "تعذر ربط الصف بالمندوب." });
    } finally {
      setSaving(false);
    }
  }

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

      {linkRow ? (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={submitLink} className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">ربط الصف رقم {linkRow.rowNumber} بمندوب</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">بعد الربط سيتم حفظ الصف داخل التقارير اليومية لو كان ملف تقرير تطبيق.</p>
              </div>
              <button type="button" onClick={() => setLinkRow(null)} className="rounded-xl border border-slate-200 px-3 py-1 text-sm font-black">
                إغلاق
              </button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
              <p>الخطأ الحالي: {linkRow.errorType} - {linkRow.errorMessage}</p>
              <p className="mt-1">حساب التطبيق من الملف: {linkRow.applicationAccount}</p>
            </div>

            <label htmlFor="import-driver-search" className="mt-4 grid gap-1 text-xs font-black text-slate-800">
              بحث سريع عن المندوب
              <input
                id="import-driver-search"
                value={driverQuery}
                onChange={(event) => setDriverQuery(event.target.value)}
                placeholder="ابحث بالكود / الاسم / الإقامة / Courier ID"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400"
              />
            </label>

            <label htmlFor="import-driver-id" className="mt-3 grid gap-1 text-xs font-black text-slate-800">
              المندوب
              <select id="import-driver-id" name="driverId" required size={8} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-400">
                {driverOptions.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setLinkRow(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
                إلغاء
              </button>
              <button type="submit" disabled={saving || !driverOptions.length} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
                {saving ? "جاري الربط..." : "ربط وحفظ الصف"}
              </button>
            </div>
          </form>
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
                    <button type="button" onClick={() => setLinkRow(row)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800">
                      ربط بمندوب
                    </button>
                    <button type="button" onClick={() => void revalidateBatch()} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">
                      إعادة احتساب
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
