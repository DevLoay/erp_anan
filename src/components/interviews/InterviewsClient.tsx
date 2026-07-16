"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { InterviewRow, InterviewsPageData } from "@/lib/interviews/getInterviewsPageData";

type FormState = {
  id: string;
  candidateName: string;
  phone: string;
  cityId: string;
  projectId: string;
  status: string;
  scheduledAt: string;
  notes: string;
};

const statusLabels: Record<string, string> = {
  PENDING: "قيد الانتظار",
  ACTIVE: "نشطة",
  APPROVED: "مقبولة",
  REJECTED: "مرفوضة",
  CANCELLED: "ملغاة",
  INACTIVE: "غير نشطة",
  LOCKED: "مغلقة",
};

const emptyForm: FormState = {
  id: "",
  candidateName: "",
  phone: "",
  cityId: "",
  projectId: "",
  status: "PENDING",
  scheduledAt: "",
  notes: "",
};

function dateInput(value: string) {
  if (!value) return "";
  return value.slice(0, 16);
}

function displayDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toCsv(rows: InterviewRow[]) {
  const header = ["الاسم", "الجوال", "المدينة", "المشروع", "الحالة", "موعد المقابلة", "تم التحويل", "ملاحظات"];
  const body = rows.map((row) => [
    row.candidateName,
    row.phone,
    row.cityName,
    row.projectName,
    statusLabels[row.status] || row.status,
    displayDate(row.scheduledAt),
    row.convertedDriverId ? "نعم" : "لا",
    row.notes,
  ]);
  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString("ar-SA")}</div>
    </div>
  );
}

function ActionButton({ children, onClick, tone = "slate", disabled }: { children: ReactNode; onClick: () => void; tone?: "slate" | "blue" | "green" | "amber" | "red"; disabled?: boolean }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`} suppressHydrationWarning>
      {children}
    </button>
  );
}

export function InterviewsClient({ data }: { data: InterviewsPageData }) {
  const router = useRouter();
  const [rows, setRows] = useState(data.rows);
  const [selected, setSelected] = useState<InterviewRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modal, setModal] = useState<"closed" | "edit" | "view">("closed");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredRows = useMemo(() => rows, [rows]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openCreate() {
    setForm(emptyForm);
    setSelected(null);
    setModal("edit");
    setMessage("");
  }

  function openEdit(row: InterviewRow) {
    setSelected(row);
    setForm({
      id: row.id,
      candidateName: row.candidateName,
      phone: row.phone,
      cityId: row.cityId,
      projectId: row.projectId,
      status: row.status,
      scheduledAt: dateInput(row.scheduledAt),
      notes: row.notes,
    });
    setModal("edit");
    setMessage("");
  }

  function openView(row: InterviewRow) {
    setSelected(row);
    setModal("view");
  }

  function exportCsv() {
    const blob = new Blob(["\ufeff" + toCsv(filteredRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function requestJson(url: string, options: RequestInit) {
    const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "تعذر تنفيذ العملية");
    return payload;
  }

  async function saveInterview() {
    try {
      setMessage("");
      const body = {
        candidateName: form.candidateName,
        phone: form.phone,
        cityId: form.cityId || null,
        projectId: form.projectId || null,
        status: form.status,
        scheduledAt: form.scheduledAt || null,
        notes: form.notes,
      };
      const payload = form.id
        ? await requestJson(`/api/interviews/${form.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await requestJson("/api/interviews", { method: "POST", body: JSON.stringify(body) });
      const next = payload.data as InterviewRow;
      setRows((current) => (form.id ? current.map((row) => (row.id === next.id ? next : row)) : [next, ...current]));
      setModal("closed");
      setMessage("تم حفظ المقابلة بنجاح.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الحفظ");
    }
  }

  async function updateStatus(row: InterviewRow, status: string) {
    try {
      const payload = await requestJson(`/api/interviews/${row.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      const next = payload.data as InterviewRow;
      setRows((current) => current.map((item) => (item.id === row.id ? next : item)));
      setMessage("تم تحديث حالة المقابلة.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث الحالة");
    }
  }

  async function deleteInterview(row: InterviewRow) {
    if (!confirm(`حذف مقابلة ${row.candidateName}؟`)) return;
    try {
      await requestJson(`/api/interviews/${row.id}`, { method: "DELETE" });
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage("تم حذف المقابلة.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الحذف");
    }
  }

  async function convertToDriver(row: InterviewRow) {
    if (!confirm(`تحويل ${row.candidateName} إلى مندوب؟`)) return;
    try {
      const payload = await requestJson(`/api/interviews/${row.id}/convert`, { method: "POST" });
      const next = payload.data as InterviewRow;
      setRows((current) => current.map((item) => (item.id === row.id ? next : item)));
      setMessage("تم تحويل المقابلة إلى مندوب وربطها بنجاح.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر التحويل");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-6" dir="rtl" suppressHydrationWarning>
      <header className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-blue-700">الموارد البشرية والتشغيل</p>
          <h1 className="text-2xl font-black">المقابلات</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">إدارة مقابلات المرشحين، متابعة الحالات، وجدولة المقابلات وتحويل المقبولين إلى مناديب.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => history.back()}>رجوع</ActionButton>
          <ActionButton onClick={() => window.print()}>طباعة / PDF</ActionButton>
          <ActionButton tone="amber" onClick={exportCsv}>تصدير إكسل</ActionButton>
          <ActionButton tone="green" onClick={openCreate}>+ إضافة مقابلة</ActionButton>
        </div>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="الإجمالي" value={data.summary.total} />
        <StatCard label="قيد الانتظار" value={data.summary.pending} />
        <StatCard label="مقبولة" value={data.summary.approved} />
        <StatCard label="مرفوضة" value={data.summary.rejected} />
        <StatCard label="ملغاة" value={data.summary.cancelled} />
        <StatCard label="تم تحويلها" value={data.summary.converted} />
      </section>

      {message ? <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-black text-blue-800">{message}</div> : null}

      <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/interviews" className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="text-xs font-black text-slate-500 xl:col-span-2">
            بحث
            <input name="q" defaultValue={data.filters.q} placeholder="اسم / جوال / ملاحظات" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          </label>
          <label className="text-xs font-black text-slate-500">
            الحالة
            <select name="status" defaultValue={data.filters.status} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black text-slate-500">
            المدينة
            <select name="cityId" defaultValue={data.filters.cityId} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المدن</option>
              {data.refs.cities.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black text-slate-500">
            المشروع
            <select name="projectId" defaultValue={data.filters.projectId} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">كل المشاريع</option>
              {data.refs.projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black text-slate-500">
            من تاريخ
            <input type="date" name="fromDate" defaultValue={data.filters.fromDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          </label>
          <label className="text-xs font-black text-slate-500">
            إلى تاريخ
            <input type="date" name="toDate" defaultValue={data.filters.toDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          </label>
          <div className="flex items-end gap-2 xl:col-span-7">
            <button type="submit" className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-black text-white" suppressHydrationWarning>تطبيق</button>
            <button type="button" onClick={() => router.push("/interviews")} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800" suppressHydrationWarning>عرض الكل</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-600">
              <tr>
                <th className="px-4 py-3">المرشح</th>
                <th className="px-4 py-3">الجوال</th>
                <th className="px-4 py-3">المدينة</th>
                <th className="px-4 py-3">المشروع</th>
                <th className="px-4 py-3">الموعد</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">تحويل</th>
                <th className="sticky left-0 bg-slate-100 px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black">{row.candidateName}</td>
                  <td className="px-4 py-3 font-bold text-slate-600">{row.phone || "-"}</td>
                  <td className="px-4 py-3">{row.cityName}</td>
                  <td className="px-4 py-3">{row.projectName}</td>
                  <td className="px-4 py-3">{displayDate(row.scheduledAt)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{statusLabels[row.status] || row.status}</span></td>
                  <td className="px-4 py-3">{row.convertedDriverId ? "تم" : "-"}</td>
                  <td className="sticky left-0 bg-white px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => openView(row)}>عرض</ActionButton>
                      <ActionButton tone="blue" onClick={() => openEdit(row)}>تعديل</ActionButton>
                      <ActionButton tone="green" onClick={() => updateStatus(row, "APPROVED")}>قبول</ActionButton>
                      <ActionButton tone="amber" onClick={() => updateStatus(row, "REJECTED")}>رفض</ActionButton>
                      <ActionButton onClick={() => convertToDriver(row)} disabled={Boolean(row.convertedDriverId)}>تحويل لمندوب</ActionButton>
                      <ActionButton tone="red" onClick={() => deleteInterview(row)}>حذف</ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm font-black text-slate-500">لا توجد مقابلات مطابقة للفلاتر الحالية.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modal !== "closed" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" suppressHydrationWarning>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">{modal === "view" ? "تفاصيل المقابلة" : form.id ? "تعديل مقابلة" : "إضافة مقابلة"}</h2>
              <button type="button" onClick={() => setModal("closed")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black" suppressHydrationWarning>إغلاق</button>
            </div>
            {modal === "view" && selected ? (
              <div className="grid gap-3 text-sm font-bold text-slate-700">
                <p><b>الاسم:</b> {selected.candidateName}</p>
                <p><b>الجوال:</b> {selected.phone || "-"}</p>
                <p><b>المدينة:</b> {selected.cityName}</p>
                <p><b>المشروع:</b> {selected.projectName}</p>
                <p><b>الحالة:</b> {statusLabels[selected.status] || selected.status}</p>
                <p><b>الموعد:</b> {displayDate(selected.scheduledAt)}</p>
                <p><b>ملاحظات:</b> {selected.notes || "-"}</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-black text-slate-500 md:col-span-2">اسم المرشح<input value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" /></label>
                <label className="text-xs font-black text-slate-500">الجوال<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" /></label>
                <label className="text-xs font-black text-slate-500">الحالة<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-black text-slate-500">المدينة<select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">بدون مدينة</option>{data.refs.cities.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}</select></label>
                <label className="text-xs font-black text-slate-500">المشروع<select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">بدون مشروع</option>{data.refs.projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
                <label className="text-xs font-black text-slate-500 md:col-span-2">موعد المقابلة<input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold" /></label>
                <label className="text-xs font-black text-slate-500 md:col-span-2">ملاحظات<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" /></label>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <ActionButton onClick={() => setModal("closed")}>إلغاء</ActionButton>
                  <ActionButton tone="green" onClick={saveInterview} disabled={isPending}>حفظ</ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
