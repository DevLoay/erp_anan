"use client";

import { useMemo, useState, type ButtonHTMLAttributes, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdvanceRow, AdvancesPageData } from "@/lib/advances/getAdvancesPageData";

type Props = {
  data: AdvancesPageData;
};

const statuses = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "DEDUCTED", label: "تم الخصم" },
  { value: "PARTIALLY_DEDUCTED", label: "تم خصم جزء" },
  { value: "CANCELLED", label: "ملغي" },
];

const statusLabels: Record<string, string> = {
  PENDING: "قيد الانتظار",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  DEDUCTED: "تم الخصم",
  PARTIALLY_DEDUCTED: "خصم جزئي",
  CANCELLED: "ملغي",
  LOCKED: "مقفول",
};

const statusTone: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  DEDUCTED: "bg-blue-100 text-blue-800",
  PARTIALLY_DEDUCTED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  LOCKED: "bg-slate-900 text-white",
};

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(value || 0);
}

function num(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[100] flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "rose" | "blue" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-black text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function Button({ children, tone = "white", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "white" | "green" | "blue" | "orange" | "red" | "dark" }) {
  const tones = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    orange: "border-orange-500 bg-orange-500 text-white hover:bg-orange-600",
    red: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  };
  return (
    <button {...props} className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${props.className || ""}`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusTone[status] || statusTone.PENDING}`}>{statusLabels[status] || status}</span>;
}

function DeductedBadge({ row }: { row: AdvanceRow }) {
  return row.isDeducted ? (
    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">تم الخصم</span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">لم تخصم</span>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdvancesPageClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdvanceRow | null>(null);
  const [details, setDetails] = useState<AdvanceRow | null>(null);
  const selectedRows = useMemo(() => data.rows.filter((row) => selectedIds.includes(row.id)), [data.rows, selectedIds]);

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    router.push(`/advances?${params.toString()}`);
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? data.rows.map((row) => row.id) : []);
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function exportRows(rows: AdvanceRow[]) {
    downloadCsv(
      "rider-advances.csv",
      ["المندوب", "ID المندوب", "المشروع", "المدينة", "المشرف", "تاريخ السلفة", "شهر الخصم", "قيمة السلفة", "الحالة", "ملاحظات", "رقم مرجعي", "أنشئت بواسطة", "اعتمدت بواسطة", "هل تم خصمها؟", "مرتبطة بأي مسير؟"],
      rows.map((row) => [
        row.driverName,
        row.driverCode,
        row.projectName,
        row.cityName,
        row.supervisorName,
        row.advanceDate,
        row.deductionMonth,
        row.amount,
        statusLabels[row.status] || row.status,
        row.reason,
        row.referenceNumber,
        row.createdBy,
        row.approvedBy,
        row.isDeducted ? "نعم" : "لا",
        row.payrollRunLabel,
      ]),
    );
  }

  async function bulk(action: "approve" | "reject" | "cancel") {
    if (!selectedIds.length) {
      setToast("اختار سلفة واحدة على الأقل.");
      return;
    }
    const res = await fetch("/api/advances/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(payload.error || "تعذر تنفيذ الإجراء.");
      return;
    }
    setToast("تم تنفيذ الإجراء بنجاح.");
    setSelectedIds([]);
    router.refresh();
  }

  async function remove(row: AdvanceRow) {
    if (!confirm(`حذف / إلغاء سلفة ${row.driverName}؟`)) return;
    const res = await fetch(`/api/advances/${row.id}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(payload.error || "تعذر حذف السلفة.");
      return;
    }
    setToast(payload.message || "تم حذف السلفة بنجاح.");
    router.refresh();
  }

  return (
    <main dir="rtl" className="min-h-screen w-full max-w-none bg-slate-50 p-4 text-slate-950">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
            <h1 className="mt-1 text-3xl font-black">سلف المناديب</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">إدارة السلف، شهر الخصم، الاعتماد، وتسميعها في مسير الرواتب.</p>
            <p className="mt-2 text-xs font-bold text-slate-400">الرئيسية / الماليات / سلف المناديب</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="green" onClick={() => { setEditing(null); setShowForm(true); }}>+ إضافة سلفة</Button>
            <Button tone="blue" onClick={() => window.location.assign("/imports/preview?importType=advances")}>استيراد Excel / PDF</Button>
            <Button tone="orange" onClick={() => exportRows(data.rows)}>تصدير Excel</Button>
            <Button onClick={() => window.print()}>طباعة / PDF</Button>
          </div>
        </div>
      </section>

      {data.databaseOffline ? (
        <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center font-black text-rose-800">
          قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.
        </section>
      ) : null}

      <section className="mt-4 grid gap-3 md:grid-cols-4">
        <SummaryCard title="إجمالي السلف" value={num(data.summary.total)} />
        <SummaryCard title="قيد الانتظار" value={num(data.summary.pending)} tone="amber" />
        <SummaryCard title="المعتمدة" value={money(data.summary.approvedAmount)} tone="emerald" />
        <SummaryCard title="تم خصمها" value={money(data.summary.deductedAmount)} tone="blue" />
        <SummaryCard title="إجمالي القيمة" value={money(data.summary.totalAmount)} />
        <SummaryCard title="مرفوض / ملغي" value={num(data.summary.rejectedOrCancelled)} tone="rose" />
        <SummaryCard title="السلف المعتمدة عددًا" value={num(data.summary.approved)} tone="emerald" />
        <SummaryCard title="مرتبطة بمسير" value={num(data.summary.deducted)} tone="blue" />
      </section>

      <form action={applyFilters} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="grid gap-1 text-xs font-black">من تاريخ<input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">إلى تاريخ<input name="toDate" type="date" defaultValue={data.filters.toDate} className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">المشروع<select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">كل المشاريع</option>
            {data.refs.applicationProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المدينة<select name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">كل المدن</option>
            {data.refs.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المشرف<select name="supervisorId" defaultValue={data.filters.supervisorId} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">كل المشرفين</option>
            {data.refs.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المندوب<select name="driverId" defaultValue={data.filters.driverId} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">كل المناديب</option>
            {data.refs.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} - {driver.internalCode}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">شهر الخصم<input name="deductionMonth" type="month" defaultValue={data.filters.deductionMonth} className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">الحالة<select name="status" defaultValue={data.filters.status} className="h-11 rounded-xl border border-slate-200 px-3">
            {statuses.map((status) => <option key={status.value || "all"} value={status.value}>{status.label}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black md:col-span-2">بحث<input name="q" defaultValue={data.filters.q} placeholder="اسم / ID / مشروع / مشرف / ملاحظات..." className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">عدد الصفوف<select name="pageSize" defaultValue={data.filters.pageSize} className="h-11 rounded-xl border border-slate-200 px-3">
            {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size} صف</option>)}
          </select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="dark" type="submit">تطبيق</Button>
          <Button type="button" onClick={() => router.push("/advances")}>عرض الكل</Button>
        </div>
      </form>

      {selectedIds.length ? (
        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-sm font-black text-blue-900">تم اختيار {num(selectedIds.length)} سلفة</p>
          <div className="flex flex-wrap gap-2">
            <Button tone="green" onClick={() => bulk("approve")}>اعتماد المحدد</Button>
            <Button tone="orange" onClick={() => bulk("reject")}>رفض المحدد</Button>
            <Button tone="red" onClick={() => bulk("cancel")}>إلغاء المحدد</Button>
            <Button onClick={() => exportRows(selectedRows)}>تصدير المحدد</Button>
          </div>
        </section>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1700px] w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-700">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={Boolean(data.rows.length && selectedIds.length === data.rows.length)} onChange={(event) => toggleAll(event.target.checked)} /></th>
                {["المندوب", "ID المندوب", "المشروع", "المدينة", "المشرف", "تاريخ السلفة", "شهر الخصم", "قيمة السلفة", "الحالة", "ملاحظات", "رقم مرجعي", "أنشئت بواسطة", "اعتمدت بواسطة", "هل تم خصمها؟", "مرتبطة بأي مسير؟", "الإجراءات"].map((head) => (
                  <th key={head} className="whitespace-nowrap px-3 py-3 text-right">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} /></td>
                  <td className="sticky right-0 z-10 bg-white px-3 py-3 font-black shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.7)]">{row.driverName}</td>
                  <td className="px-3 py-3 font-bold text-blue-900">{row.driverCode}</td>
                  <td className="px-3 py-3">{row.projectName}</td>
                  <td className="px-3 py-3">{row.cityName}</td>
                  <td className="px-3 py-3">{row.supervisorName}</td>
                  <td className="px-3 py-3">{row.advanceDate}</td>
                  <td className="px-3 py-3">{row.deductionMonth}</td>
                  <td className="px-3 py-3 font-black">{money(row.amount)}</td>
                  <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                  <td className="max-w-[220px] truncate px-3 py-3">{row.reason}</td>
                  <td className="px-3 py-3">{row.referenceNumber}</td>
                  <td className="px-3 py-3">{row.createdBy}</td>
                  <td className="px-3 py-3">{row.approvedBy}</td>
                  <td className="px-3 py-3"><DeductedBadge row={row} /></td>
                  <td className="px-3 py-3">{row.payrollRunLabel}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => setDetails(row)}>تفاصيل</Button>
                      <Button type="button" tone="blue" disabled={row.isDeducted} onClick={() => { setEditing(row); setShowForm(true); }}>تعديل</Button>
                      <Button type="button" tone="red" onClick={() => remove(row)}>حذف</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.rows.length ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center">
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8">
                      <p className="text-lg font-black">لا توجد سلف حسب الفلاتر الحالية</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">أضف سلفة جديدة أو غيّر نطاق التاريخ والفلاتر.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>عدد السجلات: {num(data.rows.length)}</span>
          <span>الصفحة 1 / 1</span>
        </div>
      </section>

      {showForm ? <AdvanceForm data={data} row={editing} onClose={() => { setShowForm(false); setEditing(null); }} onDone={(message) => { setToast(message); setShowForm(false); setEditing(null); router.refresh(); }} /> : null}
      {details ? <AdvanceDetails row={details} onClose={() => setDetails(null)} /> : null}
    </main>
  );
}

function AdvanceForm({ data, row, onClose, onDone }: { data: AdvancesPageData; row: AdvanceRow | null; onClose: () => void; onDone: (message: string) => void }) {
  const [driverId, setDriverId] = useState(row?.driverId || "");
  const selectedDriver = data.refs.drivers.find((driver) => driver.id === driverId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());
    const url = row ? `/api/advances/${row.id}` : "/api/advances";
    const res = await fetch(url, { method: row ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(payload.error || "تعذر حفظ السلفة.");
      return;
    }
    onDone(row ? "تم تعديل السلفة بنجاح." : "تم إنشاء السلفة بنجاح.");
  }
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{row ? "تعديل سلفة" : "إضافة سلفة"}</h2>
          <Button type="button" onClick={onClose}>إغلاق</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-black">المندوب<select name="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)} required className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">اختار المندوب</option>
            {data.refs.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} - {driver.internalCode}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المشروع<select name="applicationProjectId" defaultValue={row?.projectId || selectedDriver?.applicationProjectId || ""} required className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">اختار المشروع</option>
            {data.refs.applicationProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المدينة<select name="cityId" defaultValue={row?.cityId || selectedDriver?.cityId || ""} required className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">اختار المدينة</option>
            {data.refs.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">المشرف<select name="supervisorId" defaultValue={row?.supervisorId || selectedDriver?.supervisorId || ""} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="">بدون مشرف</option>
            {data.refs.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">تاريخ السلفة<input name="advanceDate" type="date" defaultValue={row?.advanceDate || today()} required className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">شهر الخصم<input name="deductionMonth" type="month" defaultValue={row?.deductionMonth !== "-" ? row?.deductionMonth : currentMonth()} required className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">قيمة السلفة<input name="amount" type="number" step="0.01" min="0.01" defaultValue={row?.amount || ""} required className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black">الحالة<select name="status" defaultValue={row?.status || "PENDING"} required className="h-11 rounded-xl border border-slate-200 px-3">
            {statuses.filter((status) => status.value).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select></label>
          <label className="grid gap-1 text-xs font-black">رقم مرجعي للسلفة<input name="referenceNumber" defaultValue={row?.referenceNumber !== "-" ? row?.referenceNumber : ""} className="h-11 rounded-xl border border-slate-200 px-3" /></label>
          <label className="grid gap-1 text-xs font-black md:col-span-3">ملاحظات<textarea name="reason" defaultValue={row?.reason !== "-" ? row?.reason : ""} className="min-h-24 rounded-xl border border-slate-200 p-3" /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>إلغاء</Button>
          <Button tone="green" type="submit">حفظ</Button>
        </div>
      </form>
    </div>
  );
}

function AdvanceDetails({ row, onClose }: { row: AdvanceRow; onClose: () => void }) {
  const fields = [
    ["المندوب", row.driverName],
    ["ID المندوب", row.driverCode],
    ["المشروع", row.projectName],
    ["المدينة", row.cityName],
    ["المشرف", row.supervisorName],
    ["تاريخ السلفة", row.advanceDate],
    ["شهر الخصم", row.deductionMonth],
    ["القيمة", money(row.amount)],
    ["المتبقي", money(row.remainingAmount)],
    ["الحالة", statusLabels[row.status] || row.status],
    ["رقم مرجعي", row.referenceNumber],
    ["أنشئت بواسطة", row.createdBy],
    ["اعتمدت بواسطة", row.approvedBy],
    ["تاريخ الاعتماد", row.approvedAt || "-"],
    ["هل تم خصمها؟", row.isDeducted ? "نعم" : "لا"],
    ["مرتبطة بأي مسير؟", row.payrollRunLabel],
    ["ملاحظات", row.reason],
  ];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">تفاصيل السلفة - {row.driverName}</h2>
          <Button onClick={onClose}>إغلاق</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <p className="mt-1 font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
