"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { VehicleField, VehicleModuleData, VehicleRow } from "@/lib/vehicles/vehicleModuleData";

type OnlineData = Extract<VehicleModuleData, { status: "online" }>;
type FormState = Record<string, string>;

const statusOptions = [
  { value: "", label: "كل الحالات" },
  { value: "ACTIVE", label: "نشط" },
  { value: "PENDING", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "LOCKED", label: "مقفل" },
  { value: "INACTIVE", label: "غير نشط" },
  { value: "AVAILABLE", label: "متاحة" },
  { value: "ASSIGNED", label: "مع مندوب" },
  { value: "MAINTENANCE", label: "صيانة" },
  { value: "ACCIDENT", label: "حادث" },
];

const vehicleStatusOptions = [
  { value: "AVAILABLE", label: "متاحة" },
  { value: "ASSIGNED", label: "مع مندوب" },
  { value: "MAINTENANCE", label: "صيانة" },
  { value: "ACCIDENT", label: "حادث" },
  { value: "INACTIVE", label: "موقوفة" },
];

const recordStatusOptions = [
  { value: "ACTIVE", label: "نشط" },
  { value: "PENDING", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "LOCKED", label: "مقفل" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "INACTIVE", label: "غير نشط" },
  { value: "CANCELLED", label: "ملغي" },
];

const movementTypeOptions = [
  { value: "تسليم", label: "تسليم" },
  { value: "استلام", label: "استلام" },
  { value: "نقل من مندوب لمندوب", label: "نقل من مندوب لمندوب" },
  { value: "دخول صيانة", label: "دخول صيانة" },
  { value: "خروج من صيانة", label: "خروج من صيانة" },
  { value: "إرجاع للشركة المالكة", label: "إرجاع للشركة المالكة" },
];

const vehicleOwnershipOptions = [
  { value: "company", label: "شركة" },
  { value: "rental", label: "إيجار" },
  { value: "personal", label: "شخصية" },
];

function statusClass(value: string) {
  const text = value.toLowerCase();
  if (text.includes("متاحة") || text.includes("available") || text.includes("active") || text.includes("نشط") || text.includes("معتمد")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (text.includes("صيانة") || text.includes("maintenance") || text.includes("pending") || text.includes("مراجعة")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (text.includes("حادث") || text.includes("accident") || text.includes("rejected") || text.includes("مرفوض") || text.includes("موقوف")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (text.includes("assigned") || text.includes("مندوب")) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function cardClass(tone?: string) {
  if (tone === "emerald") return "border-emerald-100 bg-emerald-50";
  if (tone === "amber") return "border-amber-100 bg-amber-50";
  if (tone === "red") return "border-red-100 bg-red-50";
  if (tone === "blue") return "border-blue-100 bg-blue-50";
  return "border-slate-100 bg-white";
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hasField(fields: VehicleField[], key: string) {
  return fields.some((field) => field.key === key);
}

function isAutoFilledField(data: OnlineData, fieldKey: string, vehicle?: OnlineData["refs"]["vehicles"][number]) {
  if (!vehicle) return false;
  if (fieldKey === "cityId" && vehicle.cityId) return true;
  if (fieldKey === "driverId" && vehicle.driverId && data.module.key !== "vehicle-movements") return true;
  if (fieldKey === "fromDriverId" && vehicle.driverId && data.module.key === "vehicle-movements") return true;
  return false;
}

function fieldWrapClass(field: VehicleField) {
  if (field.type === "textarea" || field.type === "file") return "md:col-span-2";
  return "";
}

function rowSearchText(row: VehicleRow) {
  return Object.values(row.values).join(" ").toLowerCase();
}

function rowStatusText(row: VehicleRow) {
  return `${row.status || ""} ${row.values.statusLabel || ""}`.toLowerCase();
}

function isFileField(field: VehicleField) {
  return field.type === "file";
}

function emptyForm(data: OnlineData): FormState {
  const form: FormState = {};
  for (const field of data.module.fields) {
    if (field.type === "file") continue;
    form[field.key] = "";
  }
  if (hasField(data.module.fields, "status")) {
    form.status = data.module.key === "vehicles" ? "AVAILABLE" : "ACTIVE";
  }
  if (hasField(data.module.fields, "date")) form.date = today();
  if (hasField(data.module.fields, "cleanDate")) form.cleanDate = today();
  if (hasField(data.module.fields, "occurredAt")) form.occurredAt = today();
  if (hasField(data.module.fields, "handoverDate")) form.handoverDate = today();
  return form;
}

function formFromRow(data: OnlineData, row: VehicleRow): FormState {
  const form = emptyForm(data);
  for (const field of data.module.fields) {
    if (field.type === "file") continue;
    form[field.key] = valueText(row.raw[field.key]);
  }
  return form;
}

function optionList(data: OnlineData, options?: string) {
  if (options === "vehicles") return data.refs.vehicles.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (options === "drivers") return data.refs.drivers.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (options === "cities") return data.refs.cities.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (options === "rentalCompanies") return data.refs.rentalCompanies.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (options === "vehicleStatus") return vehicleStatusOptions;
  if (options === "recordStatus") return recordStatusOptions;
  if (options === "movementType") return movementTypeOptions;
  if (options === "vehicleOwnership") return vehicleOwnershipOptions;
  return [];
}

function vehicleIdForAction(data: OnlineData, row: VehicleRow) {
  if (data.module.key === "vehicles") return row.id;
  return valueText(row.raw.vehicleId);
}

const vehicleQuickActions = [
  { href: "/vehicle-movements", label: "حركة", tone: "slate" },
  { href: "/vehicle-maintenance", label: "صيانة", tone: "amber" },
  { href: "/authorizations", label: "تفويض", tone: "blue" },
  { href: "/vehicle-accidents", label: "حادث", tone: "red" },
  { href: "/vehicle-damages", label: "تلفيات", tone: "red" },
  { href: "/vehicle-cleaning", label: "نظافة", tone: "emerald" },
];

function quickActionClass(tone: string) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100";
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "vehicles-report";
}


export function VehicleModernClient({ data, openCreate = false }: { data: VehicleModuleData; openCreate?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingRow, setEditingRow] = useState<VehicleRow | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [message, setMessage] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (data.status === "online" && openCreate) {
      setEditingRow(null);
      setForm(emptyForm(data));
      setFiles({});
      setIsFormOpen(true);
    }
  }, [data, openCreate]);

  useEffect(() => {
    if (data.status !== "online") return;
    const vehicleId = searchParams.get("vehicleId") || "";
    const shouldOpen = Boolean(vehicleId || searchParams.get("openCreate") || searchParams.get("new"));
    if (!shouldOpen) return;

    let next = emptyForm(data);
    if (vehicleId && hasField(data.module.fields, "vehicleId")) {
      next.vehicleId = vehicleId;
      next = applyVehicleAutoFill(next, vehicleId);
    }

    setEditingRow(null);
    setForm(next);
    setFiles({});
    setMessage(vehicleId ? "تم اختيار السيارة تلقائيًا من الرابط." : "");
    setIsFormOpen(true);
  }, [data, searchKey]);

  if (data.status === "offline") {
    return (
      <section className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 lg:px-6" dir="rtl">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          <h1 className="text-2xl font-bold">{data.module.title}</h1>
          <p className="mt-2">{data.message}</p>
        </div>
      </section>
    );
  }

  const rows = data.rows || [];
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || rowSearchText(row).includes(q);
      const matchesStatus = !statusFilter || rowStatusText(row).includes(statusFilter.toLowerCase());
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const statusQuickFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = valueText(row.values.statusLabel || row.status || "");
      if (!label) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count }));
  }, [rows]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = pageSize === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === 0 ? filteredRows.length : Math.min(startIndex + pageSize, filteredRows.length);
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const selectedVehicle = hasField(data.module.fields, "vehicleId")
    ? data.refs.vehicles.find((item) => item.id === form.vehicleId)
    : undefined;

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openNewForm() {
    setEditingRow(null);
    setForm(emptyForm(data));
    setFiles({});
    setMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(row: VehicleRow) {
    setEditingRow(row);
    setForm(formFromRow(data, row));
    setFiles({});
    setMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingRow(null);
    setFiles({});
  }

  function applyVehicleAutoFill(next: FormState, vehicleId: string) {
    const vehicle = data.refs.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) return next;

    if (vehicle.cityId && hasField(data.module.fields, "cityId")) next.cityId = vehicle.cityId;

    if (data.module.key === "vehicle-movements") {
      if (vehicle.driverId && hasField(data.module.fields, "fromDriverId")) next.fromDriverId = vehicle.driverId;
    } else if (vehicle.driverId && hasField(data.module.fields, "driverId")) {
      next.driverId = vehicle.driverId;
    }

    return next;
  }

  function updateField(key: string, value: string) {
    setForm((current) => {
      let next = { ...current, [key]: value };
      if (key === "vehicleId") next = applyVehicleAutoFill(next, value);
      if (data.module.key === "vehicle-movements" && key === "movementType") {
        if ((value === "تسليم" || value === "نقل من مندوب لمندوب") && !next.handoverDate) next.handoverDate = today();
        if ((value === "استلام" || value === "إرجاع للشركة المالكة") && !next.returnDate) next.returnDate = today();
      }
      return next;
    });
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const endpoint = editingRow
      ? `/api/${data.module.apiResource}/${editingRow.id}`
      : `/api/${data.module.apiResource}`;
    const method = editingRow ? "PUT" : "POST";
    const hasUploads = data.module.fields.some((field) => isFileField(field) && (files[field.key]?.length || 0) > 0);

    try {
      const init: RequestInit = { method };
      if (hasUploads) {
        const body = new FormData();
        for (const [key, value] of Object.entries(form)) body.append(key, value);
        for (const field of data.module.fields) {
          for (const file of files[field.key] || []) body.append(field.key, file);
        }
        init.body = body;
      } else {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(form);
      }

      const response = await fetch(endpoint, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || "تعذر حفظ البيانات");

      setMessage(editingRow ? "تم تعديل السجل بنجاح." : "تمت إضافة السجل بنجاح.");
      closeForm();
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    }
  }

  async function deleteRow(row: VehicleRow) {
    if (!window.confirm("هل تريد حذف هذا السجل؟")) return;
    setMessage("");
    try {
      const response = await fetch(`/api/${data.module.apiResource}/${row.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || "تعذر حذف السجل");
      setMessage("تم حذف السجل.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    }
  }

  async function recalculateCosts() {
    setMessage("");
    try {
      const response = await fetch("/api/vehicle-costs/recalculate", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || "تعذر تحديث التكاليف");
      setMessage("تم تحديث تكاليف السيارات تلقائيًا.");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    }
  }

  function exportCsv() {
    if (!filteredRows.length) {
      setMessage("لا توجد بيانات لتصديرها حسب الفلتر الحالي.");
      return;
    }

    const headers = data.module.columns.map((column) => csvCell(column.label));
    const body = filteredRows.map((row) =>
      data.module.columns.map((column) => csvCell(row.values[column.key] || "")).join(",")
    );
    const csv = `\uFEFF${[headers.join(","), ...body].join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(data.module.title)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(`تم تصدير ${filteredRows.length} سجل من ${data.module.title}.`);
  }

  async function copySummary() {
    const text = [
      `تقرير ${data.module.title}`,
      `عدد السجلات المعروضة: ${filteredRows.length}`,
      ...data.summary.map((item) => `${item.label}: ${item.value}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessage("تم نسخ ملخص الصفحة للحافظة.");
    } catch {
      setMessage("تعذر النسخ تلقائيًا من المتصفح، لكن التصدير يعمل بشكل طبيعي.");
    }
  }

  function printPage() {
    window.print();
  }

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-4 sm:px-5 lg:px-6" dir="rtl" suppressHydrationWarning>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">منظومة السيارات</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">{data.module.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">{data.module.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button suppressHydrationWarning onClick={openNewForm} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
              + {data.module.addLabel}
            </button>
            <button suppressHydrationWarning type="button" onClick={exportCsv} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
              تصدير CSV
            </button>
            <button suppressHydrationWarning type="button" onClick={copySummary} className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
              نسخ الملخص
            </button>
            <button suppressHydrationWarning type="button" onClick={printPage} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              طباعة
            </button>
            {(data.module.key === "vehicle-finance" || data.module.key === "vehicle-costs") && (
              <button suppressHydrationWarning onClick={recalculateCosts} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                تحديث التكاليف تلقائيًا
              </button>
            )}
            <button suppressHydrationWarning onClick={refresh} disabled={isPending} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              تحديث
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.summary.map((item) => (
          <div key={item.label} className={`min-h-[86px] rounded-3xl border p-4 shadow-sm ${cardClass(item.tone)}`}>
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col-reverse gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {data.modules.map((module) => (
              <Link
                key={module.key}
                href={module.route}
                className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${
                  module.key === data.module.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {module.title}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              المعروض: {filteredRows.length} / {rows.length}
            </span>
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="بحث باللوحة / المندوب / المدينة..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400 sm:min-w-72"
            />
            <select
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-blue-400"
              title="عدد السجلات في الصفحة"
            >
              <option value={25}>25 سجل</option>
              <option value={50}>50 سجل</option>
              <option value={100}>100 سجل</option>
              <option value={0}>كل السجلات</option>
            </select>
          </div>
        </div>

        {statusQuickFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => { setStatusFilter(""); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${!statusFilter ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
            >
              كل الحالات ({rows.length})
            </button>
            {statusQuickFilters.map((item) => (
              <button
                suppressHydrationWarning
                key={item.label}
                type="button"
                onClick={() => { setStatusFilter(item.label); setPage(1); }}
                className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${statusFilter === item.label ? "bg-blue-600 text-white ring-blue-600" : "bg-blue-50 text-blue-700 ring-blue-100 hover:bg-blue-100"}`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{message}</div>
      )}

      {data.module.key === "vehicles" && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">الإجراءات السريعة من جدول السيارات</p>
              <p className="mt-1 text-xs font-bold text-slate-500">من زر كل سيارة تقدر تسجل حركة أو صيانة أو حادث، والفورم هيفتح والسيارة متختارة تلقائيًا.</p>
            </div>
            <div className="text-xs font-bold text-slate-400">اختر الإجراء من عمود الإجراءات</div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-bold text-slate-600">
            عرض {filteredRows.length ? startIndex + 1 : 0} - {endIndex} من {filteredRows.length} سجل
            {filteredRows.length !== rows.length && <span className="text-slate-400"> / الإجمالي {rows.length}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button suppressHydrationWarning type="button" disabled={currentPage <= 1 || pageSize === 0} onClick={() => setPage(1)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">الأول</button>
            <button suppressHydrationWarning type="button" disabled={currentPage <= 1 || pageSize === 0} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">السابق</button>
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">صفحة {currentPage} / {totalPages}</span>
            <button suppressHydrationWarning type="button" disabled={currentPage >= totalPages || pageSize === 0} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">التالي</button>
            <button suppressHydrationWarning type="button" disabled={currentPage >= totalPages || pageSize === 0} onClick={() => setPage(totalPages)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">الأخير</button>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {data.module.columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-3 py-3 first:sticky first:right-0 first:z-20 first:bg-slate-50 first:shadow-[-6px_0_10px_-10px_rgba(15,23,42,.35)]">{column.label}</th>
                ))}
                <th className="sticky left-0 z-20 whitespace-nowrap bg-slate-50 px-3 py-3 shadow-[6px_0_10px_-10px_rgba(15,23,42,.35)]">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  {data.module.columns.map((column) => {
                    const value = row.values[column.key] || "-";
                    const isStatus = column.key.toLowerCase().includes("status") || column.label.includes("الحالة");
                    return (
                      <td key={column.key} className="whitespace-nowrap px-3 py-3 text-slate-700 first:sticky first:right-0 first:z-10 first:bg-white first:font-bold first:text-slate-900 first:shadow-[-6px_0_10px_-10px_rgba(15,23,42,.25)]">
                        {isStatus ? (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClass(value)}`}>{value}</span>
                        ) : (
                          <span title={value} className="block max-w-[190px] truncate">{value}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-3 shadow-[6px_0_10px_-10px_rgba(15,23,42,.25)]">
                    <div className="flex min-w-[360px] flex-wrap items-center justify-start gap-2">
                      {data.module.key === "vehicles" && (
                        <Link href={`/vehicles/${row.id}`} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">ملف السيارة</Link>
                      )}
                      {data.module.key === "vehicles" &&
                        vehicleQuickActions.slice(0, 4).map((action) => (
                          <Link
                            key={`${row.id}-${action.href}`}
                            href={`${action.href}?vehicleId=${row.id}&openCreate=1`}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${quickActionClass(action.tone)}`}
                          >
                            {action.label}
                          </Link>
                        ))}
                      {data.module.key !== "vehicles" && vehicleIdForAction(data, row) && (
                        <Link href={`/vehicles/${vehicleIdForAction(data, row)}`} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">ملف السيارة</Link>
                      )}
                      <button suppressHydrationWarning onClick={() => openEditForm(row)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">تعديل</button>
                      <button suppressHydrationWarning onClick={() => deleteRow(row)} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={data.module.columns.length + 1} className="px-4 py-12 text-center text-sm font-bold text-slate-400">
                    لا توجد سجلات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-3 sm:items-center sm:p-5">
          <form onSubmit={submitForm} className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{editingRow ? "تعديل سجل" : data.module.addLabel}</h2>
                <p className="mt-1 text-xs text-slate-500">الحقول المطلوبة مميزة بنجمة. عند اختيار السيارة يتم تعبئة المندوب والمدينة تلقائيًا إذا كانت السيارة مرتبطة بهم.</p>
              </div>
              <button suppressHydrationWarning type="button" onClick={closeForm} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">إغلاق</button>
            </div>

            {selectedVehicle && (
              <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 font-black text-blue-700">السيارة المختارة</span>
                  <span className="font-bold">{selectedVehicle.label}</span>
                  {selectedVehicle.sub && <span className="text-blue-700">{selectedVehicle.sub}</span>}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/80 px-3 py-2">المندوب: <b>{selectedVehicle.driverLabel || "غير مربوط"}</b></div>
                  <div className="rounded-2xl bg-white/80 px-3 py-2">المدينة: <b>{selectedVehicle.cityLabel || "غير محددة"}</b></div>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {data.module.fields.map((field) => {
                const autoFilled = isAutoFilledField(data, field.key, selectedVehicle);
                const selectedFiles = files[field.key] || [];
                return (
                <label key={field.key} className={fieldWrapClass(field)}>
                  <span className="mb-1 block text-sm font-bold text-slate-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </span>
                  {field.type === "select" ? (
                    <>
                      <select
                        value={form[field.key] || ""}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        required={field.required}
                        disabled={autoFilled}
                        className={`w-full min-w-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 ${autoFilled ? "bg-slate-50 text-slate-500" : ""}`}
                      >
                        <option value="">اختر</option>
                        {optionList(data, field.options).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}{option.sub ? ` - ${option.sub}` : ""}</option>
                        ))}
                      </select>
                      {autoFilled && <p className="mt-1 text-xs font-bold text-blue-600">تم تعبئة هذا الحقل تلقائيًا من السيارة.</p>}
                    </>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={form[field.key] || ""}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      required={field.required}
                      rows={4}
                      className="w-full min-w-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  ) : field.type === "file" ? (
                    <>
                      <input
                        type="file"
                        accept={field.accept}
                        multiple={field.multiple}
                        required={field.required && !editingRow}
                        onChange={(event) => setFiles((current) => ({ ...current, [field.key]: Array.from(event.target.files || []) }))}
                        className="w-full min-w-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                          <p className="font-black text-slate-700">الملفات المختارة:</p>
                          <ul className="mt-1 space-y-1">
                            {selectedFiles.map((file) => <li key={`${field.key}-${file.name}`}>• {file.name}</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <input
                      type={field.type}
                      value={form[field.key] || ""}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      required={field.required}
                      className="w-full min-w-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  )}
                </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button suppressHydrationWarning type="button" onClick={closeForm} className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700">إلغاء</button>
              <button suppressHydrationWarning type="submit" className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
