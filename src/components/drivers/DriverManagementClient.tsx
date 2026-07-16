"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DriverManagementData, DriverManagementRow } from "@/lib/drivers/getDriverManagementData";

type Props = {
  data: DriverManagementData;
};

const driverTemplateColumns = [
  "internalCode",
  "driverCode",
  "name",
  "actualName",
  "phone",
  "mobile",
  "nationalId",
  "nationality",
  "city",
  "project",
  "applicationProject",
  "supervisor",
  "vehiclePlate",
  "vehicleOwnershipType",
  "appUserId",
  "appUsername",
  "contractType",
  "sponsorshipType",
  "accommodationType",
  "housingStatus",
  "joinDate",
  "status",
  "notes",
];

const statusOptions = [
  { value: "", label: "كل الحالات" },
  { value: "ACTIVE", label: "نشط" },
  { value: "SUSPENDED", label: "موقوف" },
  { value: "INACTIVE", label: "غير نشط" },
];

const vehicleOwnershipOptions = [
  { value: "", label: "كل أنواع السيارة" },
  { value: "company_car", label: "سيارة شركة" },
  { value: "personal_car", label: "سيارة شخصية" },
  { value: "no_vehicle", label: "بدون سيارة" },
];

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value);
}

function num(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  return new Date().toISOString().slice(0, 7);
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

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function StatusBadge({ row }: { row: DriverManagementRow }) {
  const classes = {
    emerald: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  }[row.statusTone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes}`}>{row.statusLabel}</span>;
}

function vehicleLabel(value: string) {
  if (value === "company_car") return "سيارة شركة";
  if (value === "personal_car") return "سيارة شخصية";
  return "بدون سيارة";
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([`\uFEFF${headers.join(",")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  exportCsv(filename, headers, rows);
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function DriverCreateModal({ data, driver, onClose, onSaved, setToast }: { data: DriverManagementData; driver?: DriverManagementRow | null; onClose: () => void; onSaved: () => void; setToast: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(driver);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [
        "internalCode",
        "driverCode",
        "name",
        "actualName",
        "phone",
        "mobile",
        "nationalId",
        "nationality",
        "cityId",
        "applicationProjectId",
        "supervisorId",
        "vehicleId",
        "accountId",
        "vehicleOwnershipType",
        "appUserId",
        "appUsername",
        "contractType",
        "sponsorshipType",
        "accommodationType",
        "housingStatus",
        "joinDate",
        "status",
        "source",
      ].map((key) => [key, field(form, key)]),
    );

    setSaving(true);
    try {
      const response = await fetch(isEdit && driver ? `/api/drivers/${driver.id}` : "/api/drivers/manual", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { action: "update", ...payload } : payload),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; data?: { duplicateNationalId?: boolean } };
      if (!response.ok) throw new Error(result.error || "تعذر حفظ المندوب.");
      onSaved();
      if (isEdit) {
        setToast("تم تحديث بيانات المندوب بنجاح.");
        return;
      }
      setToast(result.data?.duplicateNationalId ? "تم حفظ المندوب، لكن رقم الهوية موجود سابقًا وتم تعليمه للمراجعة." : "تم إضافة المندوب بنجاح.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر حفظ المندوب.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">إضافة يدوية منفصلة عن الاستيراد</p>
            <h2 className="text-2xl font-black text-slate-950">إضافة مندوب</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-black text-slate-800">
            كود داخلي *
            <input name="internalCode" required={!isEdit} defaultValue={driver?.driverCode === "-" ? "" : driver?.driverCode ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            اسم المندوب *
            <input name="name" required defaultValue={driver?.name ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الجوال *
            <input name="phone" required defaultValue={driver?.mobile === "-" ? "" : driver?.mobile ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            المدينة *
            <select name="cityId" required defaultValue={driver?.cityId ?? ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">اختر المدينة</option>
              {data.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            مشروع التطبيق
            <select name="applicationProjectId" defaultValue={driver?.projectId ?? ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">بدون مشروع تطبيق</option>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select name="status" defaultValue={driver?.status ?? "ACTIVE"} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="ACTIVE">نشط</option>
              <option value="SUSPENDED">موقوف</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            كود المندوب
            <input name="driverCode" defaultValue={driver?.driverCode === "-" ? "" : driver?.driverCode ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الاسم الفعلي
            <input name="actualName" defaultValue={driver?.name ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            رقم الهوية / الإقامة
            <input name="nationalId" defaultValue={driver?.nationalId === "-" ? "" : driver?.nationalId ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الجنسية
            <input name="nationality" defaultValue={driver?.nationality === "-" ? "" : driver?.nationality ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            المشرف
            <select name="supervisorId" defaultValue={driver?.supervisorId ?? ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">بدون مشرف</option>
              {data.supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            نوع السيارة
            <select name="vehicleOwnershipType" defaultValue={driver?.vehicleOwnershipType ?? "no_vehicle"} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="no_vehicle">بدون سيارة</option>
              <option value="company_car">سيارة شركة</option>
              <option value="personal_car">سيارة شخصية</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            سيارة متاحة
            <select name="vehicleId" defaultValue={driver?.vehicleId ?? ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">بدون ربط سيارة</option>
              {driver?.vehicleId ? (
                <option value={driver.vehicleId}>
                  {[driver.vehiclePlate, driver.vehicleType].filter((value) => value && value !== "-").join(" - ") || "السيارة الحالية"}
                </option>
              ) : null}
              {data.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            حساب تطبيق موجود
            <select name="accountId" defaultValue={driver?.accountId ?? ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">بدون حساب موجود</option>
              {driver?.accountId ? (
                <option value={driver.accountId}>
                  {[driver.application, driver.project, driver.appUserId, driver.appUsername].filter((value) => value && value !== "-").join(" - ") || "الحساب الحالي"}
                </option>
              ) : null}
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            App User ID
            <input name="appUserId" defaultValue={driver?.appUserId === "-" ? "" : driver?.appUserId ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            App Username
            <input name="appUsername" defaultValue={driver?.appUsername === "-" ? "" : driver?.appUsername ?? ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            نوع العقد
            <input name="contractType" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            نوع الكفالة
            <input name="sponsorshipType" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            نوع السكن
            <input name="accommodationType" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            حالة السكن
            <input name="housingStatus" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            تاريخ البداية
            <input name="joinDate" type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          لو اخترت سيارة، النظام سيرفض السيارة المرتبطة بمندوب نشط. ولو اخترت حساب تطبيق مرتبط بمندوب آخر سيتم إيقاف الحفظ لحماية الربط.
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ المندوب"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DriverManagementClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [showCreate, setShowCreate] = useState(data.filters.newDriver === "1");
  const [editingDriver, setEditingDriver] = useState<DriverManagementRow | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverManagementRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSupervisorId, setBulkSupervisorId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const rows = data.rows;
  const visibleRows = useMemo(() => rows.slice(0, 100), [rows]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));

  function refresh() {
    router.refresh();
  }

  function exportCurrentDrivers() {
    const headers = ["internalCode", "name", "phone", "nationalId", "city", "applicationProject", "application", "supervisor", "vehicle", "vehicleOwnershipType", "appUserId", "status"];
    downloadCsv(`drivers-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows.map((row) => [row.driverCode, row.name, row.mobile, row.nationalId, row.city, row.project, row.application, row.supervisor, row.vehiclePlate, vehicleLabel(row.vehicleOwnershipType), row.appUserId, row.statusLabel]),
    );
    setToast("تم تجهيز ملف المناديب الحالي.");
  }

  function exportDriverTemplate() {
    downloadCsv("drivers-template.csv", driverTemplateColumns, []);
    setToast("تم تجهيز قالب المناديب بنفس حقول الإضافة اليدوية.");
  }

  function toggleRow(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleVisibleRows() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleRows.some((row) => row.id === id));
      return [...new Set([...current, ...visibleRows.map((row) => row.id)])];
    });
  }

  async function applyBulkSupervisor() {
    if (!selectedIds.length || !bulkSupervisorId) {
      setToast("اختر المناديب والمشرف أولًا.");
      return;
    }
    const confirmed = window.confirm(`تأكيد ربط ${selectedIds.length} مندوب بالمشرف المحدد؟`);
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const response = await fetch("/api/drivers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignSupervisor", driverIds: selectedIds, supervisorId: bulkSupervisorId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; data?: { updatedCount?: number; skippedCount?: number } };
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ التعديل الجماعي.");
      setToast(`تم تحديث ${payload.data?.updatedCount ?? 0} مندوب. المتجاوز: ${payload.data?.skippedCount ?? 0}`);
      setSelectedIds([]);
      setBulkSupervisorId("");
      refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر تنفيذ التعديل الجماعي.");
    } finally {
      setBulkSaving(false);
    }
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-black">إدارة المناديب</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage || "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {showCreate ? <DriverCreateModal data={data} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refresh(); }} setToast={setToast} /> : null}
      {editingDriver ? <DriverCreateModal data={data} driver={editingDriver} onClose={() => setEditingDriver(null)} onSaved={() => { setEditingDriver(null); refresh(); }} setToast={setToast} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <nav className="mb-1 text-xs font-black text-slate-500">الرئيسية &gt; المناديب والموارد البشرية &gt; إدارة المناديب</nav>
          <h1 className="text-3xl font-black text-slate-950">إدارة المناديب</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">إضافة يدوية، استيراد Excel، ربط المشرفين، وربط المناديب بالمدينة والمشروع والحسابات.</p>
        </div>
        <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          رجوع
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
              + إضافة مندوب
            </button>
            <Link href="/imports/preview?importType=drivers" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
              استيراد مناديب
            </Link>
            <button type="button" onClick={exportDriverTemplate} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              تصدير قالب المناديب
            </button>
            <button type="button" onClick={exportCurrentDrivers} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600">
              تصدير المناديب الحالية
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              طباعة / PDF
            </button>
          </div>

          <form method="get" className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-800">
              من تاريخ
              <input name="fromDate" defaultValue={data.filters.fromDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-800">
              إلى تاريخ
              <input name="toDate" defaultValue={data.filters.toDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
          </form>
        </div>
      </div>

      <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="fromDate" value={data.filters.fromDate} />
        <input type="hidden" name="toDate" value={data.filters.toDate} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input name="q" defaultValue={data.filters.q} placeholder="بحث بالاسم / الكود / الجوال / الهوية / حساب التطبيق" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400 xl:col-span-2" />
          <select name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <select name="projectId" defaultValue={data.filters.projectId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل مشاريع التطبيقات</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select name="supervisorId" defaultValue={data.filters.supervisorId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المشرفين</option>
            {data.supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={data.filters.status} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            {statusOptions.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select name="vehicleOwnershipType" defaultValue={data.filters.vehicleOwnershipType} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            {vehicleOwnershipOptions.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm hover:bg-slate-800">
            تطبيق
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <Link href="/drivers" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
            عرض الكل
          </Link>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="إجمالي المناديب" value={num(data.summary.totalDrivers)} tone="blue" />
        <SummaryCard title="نشط" value={num(data.summary.activeDrivers)} tone="emerald" />
        <SummaryCard title="موقوف" value={num(data.summary.suspendedDrivers)} tone={data.summary.suspendedDrivers ? "red" : "slate"} />
        <SummaryCard title="طلبات الفترة" value={num(data.summary.monthOrders)} />
        <SummaryCard title="بدون حساب تطبيق" value={num(data.summary.withoutAppAccount)} tone={data.summary.withoutAppAccount ? "amber" : "emerald"} />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">{data.insight}</div>

      {selectedIds.length ? (
        <div className="sticky top-2 z-20 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-amber-950">تم تحديد {num(selectedIds.length)} مندوب</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={bulkSupervisorId} onChange={(event) => setBulkSupervisorId(event.target.value)} className="h-11 min-w-64 rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold">
                <option value="">اختر مشرف للتعيين الجماعي</option>
                {data.supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={applyBulkSupervisor} disabled={bulkSaving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white disabled:opacity-60">
                {bulkSaving ? "جاري التنفيذ..." : "تطبيق"}
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
                إلغاء التحديد
              </button>
            </div>
          </div>
          {selectedRows.length ? <p className="mt-2 text-xs font-bold text-amber-900">المحدد: {selectedRows.slice(0, 5).map((row) => row.name).join("، ")}{selectedRows.length > 5 ? "..." : ""}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700">
                  <th className="rounded-r-xl px-3 py-3 text-right">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleRows} className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-3 py-3 text-right">الاسم</th>
                  <th className="px-3 py-3 text-right">الجوال</th>
                  <th className="px-3 py-3 text-right">الجنسية</th>
                  <th className="px-3 py-3 text-right">المدينة</th>
                  <th className="px-3 py-3 text-right">مشروع التطبيق</th>
                  <th className="px-3 py-3 text-right">التطبيق</th>
                  <th className="px-3 py-3 text-right">حساب التطبيق</th>
                  <th className="px-3 py-3 text-right">المشرف</th>
                  <th className="px-3 py-3 text-right">نوع السيارة</th>
                  <th className="px-3 py-3 text-right">لوحة السيارة</th>
                  <th className="px-3 py-3 text-right">الحالة</th>
                  <th className="px-3 py-3 text-right">طلبات الفترة</th>
                  <th className="px-3 py-3 text-right">سلف معتمدة</th>
                  <th className="px-3 py-3 text-right">سلف معلقة</th>
                  <th className="rounded-l-xl px-3 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="border-b border-slate-100 px-3 py-4">
                      <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-3 py-4 shadow-[-8px_0_16px_-14px_rgba(15,23,42,0.45)]">
                      <button type="button" onClick={() => setSelectedDriver(row)} className="text-right font-black text-slate-950 hover:text-blue-700">
                        {row.name}
                      </button>
                      <div className="text-xs font-bold text-slate-500">{row.driverCode}</div>
                      <div className="text-xs font-medium text-slate-400">{row.nationalId}</div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.mobile}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.nationality}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.city}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.project}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.application}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.appUserId}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.supervisor}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{vehicleLabel(row.vehicleOwnershipType)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.vehiclePlate}</td>
                    <td className="border-b border-slate-100 px-3 py-4"><StatusBadge row={row} /></td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black">{num(row.monthOrders)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{money(row.approvedAdvances)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{money(row.pendingAdvances)}</td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <div className="flex min-w-[210px] flex-wrap gap-1">
                        <Link href={`/drivers/${row.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">فتح</Link>
                        <button type="button" onClick={() => setEditingDriver(row)} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800 hover:bg-amber-100">تعديل</button>
                        <button type="button" onClick={() => setSelectedDriver(row)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">تفاصيل</button>
                        <Link href={`/rider-reports?driverId=${row.id}`} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-800 hover:bg-blue-100">تقرير</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">لا توجد مناديب مطابقة للفلاتر الحالية</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">يمكن إضافة مندوب يدويًا أو استخدام استيراد المناديب كمسار منفصل.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
                + إضافة مندوب
              </button>
              <Link href="/imports/preview?importType=drivers" className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
                استيراد مناديب
              </Link>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>عدد السجلات: {num(rows.length)} | المعروض: {num(visibleRows.length)}</span>
          <span>صفحة 1 / 1</span>
        </div>
      </div>

      {selectedDriver ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{selectedDriver.name}</h2>
                <p className="text-sm font-bold text-slate-500">{selectedDriver.driverCode} · {selectedDriver.nationalId}</p>
              </div>
              <button type="button" onClick={() => setSelectedDriver(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                إغلاق
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SummaryCard title="طلبات الفترة" value={num(selectedDriver.monthOrders)} tone="blue" />
              <SummaryCard title="سلف معتمدة" value={money(selectedDriver.approvedAdvances)} tone="emerald" />
              <SummaryCard title="صافي آخر مسير" value={money(selectedDriver.netPayroll)} tone={selectedDriver.netPayroll < 0 ? "red" : "slate"} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["الجوال", selectedDriver.mobile],
                ["المدينة", selectedDriver.city],
                ["مشروع التطبيق", selectedDriver.project],
                ["التطبيق", selectedDriver.application],
                ["حساب التطبيق", selectedDriver.appUserId],
                ["اسم الحساب", selectedDriver.appUsername],
                ["المشرف", selectedDriver.supervisor],
                ["نوع السيارة", vehicleLabel(selectedDriver.vehicleOwnershipType)],
                ["لوحة السيارة", selectedDriver.vehiclePlate],
                ["أيام الإيجار", selectedDriver.rentalDays],
                ["آخر تقرير", selectedDriver.lastReportDate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
