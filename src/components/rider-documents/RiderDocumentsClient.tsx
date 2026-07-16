"use client";

import { useMemo, useState } from "react";
import type { RiderDocumentsData } from "@/lib/rider-documents/getRiderDocumentsData";

type DocumentRow = RiderDocumentsData["documents"][number];
type DriverOption = RiderDocumentsData["drivers"][number];

type FormState = {
  id?: string;
  driverId: string;
  type: string;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  verificationStatus: string;
  fileUrl: string;
  notes: string;
};

const emptyForm: FormState = {
  driverId: "",
  type: "iqama",
  documentType: "إقامة",
  documentNumber: "",
  issueDate: "",
  expiryDate: "",
  status: "PENDING",
  verificationStatus: "pending",
  fileUrl: "",
  notes: "",
};

function fmt(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ar-SA");
}

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function driverName(driver?: DocumentRow["driver"] | DriverOption | null, row?: DocumentRow | null) {
  if (row?.driverDisplayName) return row.driverDisplayName;
  if (!driver) {
    if (row?.driverId) return `غير مربوط - ${row.driverId}`;
    return "—";
  }
  const name = [driver.actualName, driver.name].filter(Boolean).join(" / ");
  const code = "internalCode" in driver ? driver.internalCode || driver.driverCode || driver.nationalId : null;
  if (name && code) return `${name} - ${code}`;
  return name || code || "—";
}

function driverLinkLabel(row: DocumentRow) {
  if (row.driverLinkStatus === "LINKED") return null;
  if (row.driverLinkStatus === "AUTO_MATCHED") {
    if (String(row.driverMatchedBy || "").startsWith("documentNumber")) return "تم الربط تلقائيًا برقم المستند";
    return "تم الربط تلقائيًا بكود قديم";
  }
  return "غير مربوط بملف مندوب";
}

function driverLinkClass(row: DocumentRow) {
  if (row.driverLinkStatus === "UNMATCHED") return "text-red-600";
  return "text-emerald-600";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    PENDING: "معلّق",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    CANCELLED: "ملغي",
    LOCKED: "مقفل",
  };
  return map[status] || status;
}

function verificationLabel(value: string) {
  const map: Record<string, string> = {
    pending: "بانتظار المراجعة",
    verified: "موثق",
    rejected: "مرفوض",
    expired: "منتهي",
  };
  return map[value] || value || "—";
}

function expiryTone(expiryDate?: string | Date | null) {
  if (!expiryDate) return "bg-slate-100 text-slate-700";
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "bg-red-100 text-red-700";
  if (diff <= 30) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function expiryText(expiryDate?: string | Date | null) {
  if (!expiryDate) return "بدون تاريخ";
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `منتهي منذ ${Math.abs(diff)} يوم`;
  if (diff === 0) return "ينتهي اليوم";
  return `متبقي ${diff} يوم`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export function RiderDocumentsClient({ data }: { data: RiderDocumentsData }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedDriver = useMemo(() => data.drivers.find((driver) => driver.id === form?.driverId), [data.drivers, form?.driverId]);

  function openCreate() {
    setError("");
    setForm({ ...emptyForm });
  }

  function openEdit(row: DocumentRow) {
    setError("");
    setForm({
      id: row.id,
      driverId: row.driver?.id || row.driverId,
      type: row.type || row.documentType || "other",
      documentType: row.documentType || row.type || "",
      documentNumber: row.documentNumber || "",
      issueDate: toDateInput(row.issueDate),
      expiryDate: toDateInput(row.expiryDate),
      status: row.status || "PENDING",
      verificationStatus: row.verificationStatus || "pending",
      fileUrl: row.fileUrl || "",
      notes: row.notes || "",
    });
  }

  async function saveForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.driverId) {
      setError("اختار المندوب أولًا.");
      return;
    }
    setSaving(true);
    setError("");
    const method = form.id ? "PATCH" : "POST";
    const url = form.id ? `/api/rider-documents/${form.id}` : "/api/rider-documents";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(payload?.error || "تعذر حفظ المستند.");
      return;
    }
    window.location.reload();
  }

  async function patchRow(row: DocumentRow, updates: Partial<FormState>) {
    const res = await fetch(`/api/rider-documents/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      alert(payload?.error || "تعذر تحديث المستند.");
      return;
    }
    window.location.reload();
  }

  async function deleteRow(row: DocumentRow) {
    if (!confirm(`حذف مستند ${row.documentType || row.type}؟`)) return;
    const res = await fetch(`/api/rider-documents/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      alert(payload?.error || "تعذر حذف المستند.");
      return;
    }
    window.location.reload();
  }

  function downloadCsv() {
    const headers = ["المندوب", "الكود", "النوع", "الرقم", "الإصدار", "الانتهاء", "الحالة", "المراجعة", "ملاحظات"];
    const rows = data.documents.map((row) => [
      driverName(row.driver, row),
      row.driverCodeDisplay || row.driver?.internalCode || row.driver?.driverCode,
      row.documentType || row.type,
      row.documentNumber,
      fmt(row.issueDate),
      fmt(row.expiryDate),
      statusLabel(row.status),
      verificationLabel(row.verificationStatus),
      row.notes,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rider-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-6" dir="rtl" suppressHydrationWarning>
      <header className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black text-blue-600">الموارد البشرية</p>
          <h1 className="text-2xl font-black">مستندات المناديب</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة الإقامات والرخص والعقود والتنبيهات قبل الانتهاء.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => history.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black hover:bg-slate-50">رجوع</button>
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black hover:bg-slate-50">طباعة / PDF</button>
          <button type="button" onClick={downloadCsv} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 hover:bg-amber-100">تصدير إكسل</button>
          <button type="button" onClick={openCreate} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">+ إضافة مستند</button>
        </div>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-5">
        <SummaryCard title="إجمالي المستندات" value={data.summary.total} />
        <SummaryCard title="بانتظار المراجعة" value={data.summary.pending} tone="amber" />
        <SummaryCard title="موثقة / معتمدة" value={data.summary.approved} tone="green" />
        <SummaryCard title="تنتهي خلال 30 يوم" value={data.summary.expiringSoon} tone="orange" />
        <SummaryCard title="منتهية" value={data.summary.expired} tone="red" />
      </section>

      {data.summary.orphaned || data.summary.autoMatched ? (
        <section className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          <p className="font-black">تنبيه ربط المستندات بالمناديب</p>
          <p className="mt-1 font-bold">
            تم ربط {data.summary.autoMatched || 0} مستند تلقائيًا من كود قديم أو رقم مستند، ويوجد {data.summary.orphaned || 0} مستند غير مربوط بملف مندوب.
          </p>
          <p className="mt-1 text-xs font-bold text-amber-700">
            لو ظهر مستند غير مربوط، شغّل audit الموجود في الباتش لمعرفة driverId أو رقم المستند المطلوب تصحيحه.
          </p>
        </section>
      ) : null}

      <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/rider-documents" className="grid gap-3 md:grid-cols-7">
          <label className="text-xs font-black text-slate-600 md:col-span-2">
            بحث
            <input name="q" defaultValue={data.filters.q} placeholder="مندوب / كود / رقم مستند" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="text-xs font-black text-slate-600">
            النوع
            <select name="type" defaultValue={data.filters.type} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">الكل</option>
              {data.documentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black text-slate-600">
            الحالة
            <select name="status" defaultValue={data.filters.status} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">الكل</option>
              <option value="PENDING">معلّق</option>
              <option value="APPROVED">معتمد</option>
              <option value="REJECTED">مرفوض</option>
              <option value="ACTIVE">نشط</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </label>
          <label className="text-xs font-black text-slate-600">
            المراجعة
            <select name="verificationStatus" defaultValue={data.filters.verificationStatus} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">الكل</option>
              <option value="pending">بانتظار</option>
              <option value="verified">موثق</option>
              <option value="rejected">مرفوض</option>
              <option value="expired">منتهي</option>
            </select>
          </label>
          <label className="text-xs font-black text-slate-600">
            الانتهاء
            <select name="expiry" defaultValue={data.filters.expiry} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">الكل</option>
              <option value="30">خلال 30 يوم</option>
              <option value="60">خلال 60 يوم</option>
              <option value="expired">منتهي</option>
              <option value="missing">بدون تاريخ</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">تطبيق</button>
            <button type="button" onClick={() => (window.location.href = "/rider-documents")} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">عرض الكل</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-600">
              <tr>
                <th className="px-3 py-3">المندوب</th>
                <th className="px-3 py-3">المدينة / المشروع</th>
                <th className="px-3 py-3">نوع المستند</th>
                <th className="px-3 py-3">رقم المستند</th>
                <th className="px-3 py-3">الإصدار</th>
                <th className="px-3 py-3">الانتهاء</th>
                <th className="px-3 py-3">الحالة</th>
                <th className="px-3 py-3">المراجعة</th>
                <th className="px-3 py-3">الملف</th>
                <th className="sticky left-0 bg-slate-100 px-3 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.documents.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-slate-500">لا توجد مستندات مطابقة للفلاتر الحالية.</td></tr>
              ) : data.documents.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-black">
                    {driverName(row.driver, row)}
                    <div className="text-xs font-bold text-slate-400">{row.driverPhoneDisplay || row.driver?.phone || row.driver?.mobile || "—"}</div>
                    {driverLinkLabel(row) ? <div className={`text-xs font-black ${driverLinkClass(row)}`}>{driverLinkLabel(row)}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {row.driverCityName || row.driver?.city?.nameAr || row.driver?.city?.nameEn || "—"}
                    <div className="text-xs text-slate-400">{row.driverProjectName || row.driver?.project?.name || row.driver?.project?.appName || "—"}</div>
                  </td>
                  <td className="px-3 py-3 font-bold">{row.documentType || row.type}</td>
                  <td className="px-3 py-3">{row.documentNumber || "—"}</td>
                  <td className="px-3 py-3">{fmt(row.issueDate)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-black ${expiryTone(row.expiryDate)}`}>{expiryText(row.expiryDate)}</span>
                    <div className="mt-1 text-xs text-slate-400">{fmt(row.expiryDate)}</div>
                  </td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{statusLabel(row.status)}</span></td>
                  <td className="px-3 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{verificationLabel(row.verificationStatus)}</span></td>
                  <td className="px-3 py-3">{row.fileUrl ? <a href={row.fileUrl} target="_blank" className="font-black text-blue-700 underline">فتح الملف</a> : "—"}</td>
                  <td className="sticky left-0 bg-white px-3 py-3 shadow-[-6px_0_12px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => openEdit(row)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white">تعديل</button>
                      <button type="button" onClick={() => patchRow(row, { status: "APPROVED", verificationStatus: "verified" })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">اعتماد</button>
                      <button type="button" onClick={() => patchRow(row, { status: "REJECTED", verificationStatus: "rejected" })} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-white">رفض</button>
                      <button type="button" onClick={() => deleteRow(row)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={saveForm} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">{form.id ? "تعديل مستند" : "إضافة مستند"}</h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black">إغلاق</button>
            </div>
            {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700">{error}</div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-black text-slate-600 md:col-span-2">
                المندوب
                <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" required>
                  <option value="">اختار المندوب</option>
                  {data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverName(driver)}</option>)}
                </select>
              </label>
              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 md:col-span-2">
                المندوب المختار: <span className="font-black text-slate-800">{driverName(selectedDriver)}</span>
              </div>
              <label className="text-xs font-black text-slate-600">
                كود النوع
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, documentType: data.documentTypes.find((item) => item.value === e.target.value)?.label || form.documentType })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  {data.documentTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black text-slate-600">
                اسم المستند
                <input value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-black text-slate-600">
                رقم المستند
                <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-black text-slate-600">
                رابط الملف
                <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-black text-slate-600">
                تاريخ الإصدار
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-black text-slate-600">
                تاريخ الانتهاء
                <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-black text-slate-600">
                الحالة
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="PENDING">معلّق</option>
                  <option value="APPROVED">معتمد</option>
                  <option value="REJECTED">مرفوض</option>
                  <option value="ACTIVE">نشط</option>
                  <option value="CANCELLED">ملغي</option>
                </select>
              </label>
              <label className="text-xs font-black text-slate-600">
                مراجعة الملف
                <select value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="pending">بانتظار</option>
                  <option value="verified">موثق</option>
                  <option value="rejected">مرفوض</option>
                  <option value="expired">منتهي</option>
                </select>
              </label>
              <label className="text-xs font-black text-slate-600 md:col-span-2">
                ملاحظات
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black">إلغاء</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "amber" | "green" | "orange" | "red" }) {
  const cls: Record<string, string> = {
    slate: "bg-white text-slate-950 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${cls[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
