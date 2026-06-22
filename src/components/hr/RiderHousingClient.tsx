"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { RiderHousingData, RiderHousingRow } from "@/lib/hr/getRiderHousingData";

type Props = {
  data: RiderHousingData;
};

function fmt(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function money(value: number) {
  return value ? new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value) : "-";
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function Badge({ text, tone = "slate" }: { text: string; tone?: "slate" | "emerald" | "amber" | "blue" }) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes[tone]}`}>{text}</span>;
}

function housingTone(type: string): "slate" | "emerald" | "amber" | "blue" {
  if (type === "company_housing") return "blue";
  if (type === "external_housing") return "emerald";
  if (type === "no_housing") return "slate";
  return "amber";
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function exportCsv(rows: RiderHousingRow[]) {
  const headers = ["المندوب", "الكود", "الإقامة", "المدينة", "المشروع", "المشرف", "نوع السكن", "الموقع", "الغرفة", "التكلفة", "من تاريخ", "إلى تاريخ", "أثر المسير", "الحالة"];
  const lines = rows.map((row) =>
    [row.driverName, row.driverCode, row.nationalId, row.city, row.project, row.supervisor, row.housingLabel, row.location, row.roomNumber, row.monthlyCost, row.startDate, row.endDate, row.payrollImpact, row.statusLabel]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([`\uFEFF${headers.join(",")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rider-housing.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function HousingModal({ row, data, onClose, onDone }: { row: RiderHousingRow | null; data: RiderHousingData; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      driverId: field(form, "driverId"),
      housingType: field(form, "housingType"),
      accommodationType: field(form, "accommodationType"),
      location: field(form, "location"),
      roomNumber: field(form, "roomNumber"),
      monthlyCost: field(form, "monthlyCost"),
      status: field(form, "status"),
      startDate: field(form, "startDate"),
      endDate: field(form, "endDate"),
      notes: field(form, "notes"),
    };
    setSaving(true);
    try {
      const url = row?.id ? `/api/hr/housing/${row.id}` : "/api/hr/housing";
      const response = await fetch(url, { method: row?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ سجل السكن.");
      onDone(payload.message || "تم حفظ سجل السكن.");
      router.refresh();
    } catch (error) {
      onDone(error instanceof Error ? error.message : "تعذر حفظ سجل السكن.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">سكن المناديب</p>
            <h2 className="text-2xl font-black text-slate-950">{row ? `تعديل سكن ${row.driverName}` : "إضافة سجل سكن"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-black text-slate-800">
            المندوب
            <select name="driverId" defaultValue={row?.driverId || data.filters.driverId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" required>
              <option value="">اختر المندوب</option>
              {data.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            نوع السكن
            <select name="housingType" defaultValue={row?.housingType || "company_housing"} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" required>
              <option value="company_housing">سكن شركة</option>
              <option value="external_housing">سكن خارجي</option>
              <option value="no_housing">بدون سكن</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            تصنيف السكن
            <input name="accommodationType" defaultValue={row?.accommodationType === "-" ? "" : row?.accommodationType} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الموقع
            <input name="location" defaultValue={row?.location === "-" ? "" : row?.location} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            رقم الغرفة
            <input name="roomNumber" defaultValue={row?.roomNumber === "-" ? "" : row?.roomNumber} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            التكلفة الشهرية
            <input name="monthlyCost" type="number" step="0.01" defaultValue={row?.monthlyCost || 0} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            من تاريخ
            <input name="startDate" type="date" defaultValue={row?.startDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            إلى تاريخ
            <input name="endDate" type="date" defaultValue={row?.endDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select name="status" defaultValue={row?.status || "ACTIVE"} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="ACTIVE">نشط</option>
              <option value="PENDING">قيد المراجعة</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800 md:col-span-2">
            ملاحظات
            <textarea name="notes" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
          </label>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-950">
          سكن الشركة لا يضيف بدل سكن في المسير. السكن الخارجي يضيف بدل السكن من خطة الراتب فقط.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ السكن"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RiderHousingClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<RiderHousingRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function deactivate(row: RiderHousingRow) {
    if (!row.id) {
      setToast("لا يوجد سجل سكن مسجل لهذا المندوب.");
      return;
    }
    const ok = window.confirm("تأكيد تعطيل سجل السكن؟");
    if (!ok) return;
    const response = await fetch(`/api/hr/housing/${row.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      setToast(payload.error || "تعذر تعطيل سجل السكن.");
      return;
    }
    setToast(payload.message || "تم تعطيل سجل السكن.");
    router.refresh();
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <h1 className="text-2xl font-black">سكن المناديب</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage || "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {creating ? <HousingModal row={null} data={data} onClose={() => setCreating(false)} onDone={(message) => { setToast(message); setCreating(false); }} /> : null}
      {editing ? <HousingModal row={editing} data={data} onClose={() => setEditing(null)} onDone={(message) => { setToast(message); setEditing(null); }} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <nav className="mb-1 text-xs font-black text-slate-500">الرئيسية &gt; الموارد البشرية &gt; سكن المناديب</nav>
          <h1 className="text-3xl font-black text-slate-950">سكن المناديب</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">إدارة سكن الشركة والسكن الخارجي وربط أثر السكن بمسير الرواتب.</p>
        </div>
        <Link href="/hr" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          رجوع للموارد البشرية
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCreating(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
              + إضافة سكن
            </button>
            <button type="button" onClick={() => exportCsv(data.rows)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
              تصدير Excel
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              طباعة / PDF
            </button>
          </div>
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <input name="q" defaultValue={data.filters.q} placeholder="بحث بالمندوب / الكود / الإقامة" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            <select name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المدن</option>
              {data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
            <select name="housingType" defaultValue={data.filters.housingType} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل أنواع السكن</option>
              <option value="company_housing">سكن شركة</option>
              <option value="external_housing">سكن خارجي</option>
              <option value="no_housing">بدون سكن</option>
            </select>
            <button type="submit" className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm">تطبيق</button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard title="إجمالي المناديب" value={fmt(data.summary.totalDrivers)} tone="blue" />
        <SummaryCard title="سكن شركة" value={fmt(data.summary.companyHousing)} tone="blue" />
        <SummaryCard title="سكن خارجي" value={fmt(data.summary.externalHousing)} tone="emerald" />
        <SummaryCard title="بدون سكن" value={fmt(data.summary.noHousing)} />
        <SummaryCard title="سجلات نشطة" value={fmt(data.summary.activeRecords)} tone="amber" />
        <SummaryCard title="تكلفة السكن الشهرية" value={money(data.summary.totalMonthlyCost)} />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">{data.insight}</div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {data.rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700">
                  <th className="rounded-r-xl px-3 py-3 text-right">المندوب</th>
                  <th className="px-3 py-3 text-right">ID المندوب</th>
                  <th className="px-3 py-3 text-right">الإقامة</th>
                  <th className="px-3 py-3 text-right">المدينة</th>
                  <th className="px-3 py-3 text-right">المشروع</th>
                  <th className="px-3 py-3 text-right">المشرف</th>
                  <th className="px-3 py-3 text-right">نوع السكن</th>
                  <th className="px-3 py-3 text-right">الموقع</th>
                  <th className="px-3 py-3 text-right">الغرفة</th>
                  <th className="px-3 py-3 text-right">التكلفة</th>
                  <th className="px-3 py-3 text-right">من تاريخ</th>
                  <th className="px-3 py-3 text-right">إلى تاريخ</th>
                  <th className="px-3 py-3 text-right">أثر المسير</th>
                  <th className="px-3 py-3 text-right">الحالة</th>
                  <th className="rounded-l-xl px-3 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.driverId}:${row.id || "missing"}`} className="border-b border-slate-100">
                    <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-3 py-4 shadow-[-8px_0_16px_-14px_rgba(15,23,42,0.45)]">
                      <Link href={`/drivers/${row.driverId}`} className="font-black text-slate-950 hover:text-blue-700">{row.driverName}</Link>
                      <div className="text-xs font-bold text-slate-500">{row.driverCode}</div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.driverCode}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.nationalId}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.city}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.project}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.supervisor}</td>
                    <td className="border-b border-slate-100 px-3 py-4"><Badge text={row.housingLabel} tone={housingTone(row.housingType)} /></td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.location}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.roomNumber}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black">{money(row.monthlyCost)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.startDate || "-"}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.endDate || "-"}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.payrollImpact}</td>
                    <td className="border-b border-slate-100 px-3 py-4"><Badge text={row.statusLabel} tone={row.hasRecord ? "emerald" : "slate"} /></td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <div className="flex min-w-56 flex-wrap gap-1">
                        <button type="button" onClick={() => setEditing(row)} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-black text-white">تعديل</button>
                        <Link href={`/drivers/${row.driverId}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-800">ملف المندوب</Link>
                        <button type="button" onClick={() => deactivate(row)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">تعطيل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">لا توجد بيانات سكن حسب الفلاتر الحالية</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">أضف سجل سكن أو غيّر الفلاتر لعرض المناديب.</p>
          </div>
        )}
        <div className="mt-4 text-xs font-bold text-slate-500">عدد السجلات: {fmt(data.rows.length)} | صفحة 1 / 1</div>
      </div>
    </section>
  );
}
