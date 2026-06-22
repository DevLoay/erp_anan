"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VehicleField, VehicleModuleData, VehicleRow } from "@/lib/vehicles/vehicleModuleData";

type OnlineData = Extract<VehicleModuleData, { status: "online" }>;

type FormState = Record<string, string>;

const statusOptions = [
  { value: "ACTIVE", label: "نشط" },
  { value: "PENDING", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "LOCKED", label: "مقفل" },
  { value: "INACTIVE", label: "غير نشط" },
  { value: "CANCELLED", label: "ملغي" },
];

const vehicleStatusOptions = [
  { value: "AVAILABLE", label: "متاحة" },
  { value: "ASSIGNED", label: "مع مندوب" },
  { value: "MAINTENANCE", label: "صيانة" },
  { value: "ACCIDENT", label: "حادث" },
  { value: "INACTIVE", label: "موقوفة" },
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

function hasField(fields: VehicleField[], key: string) {
  return fields.some((field) => field.key === key);
}

function initialForm(fields: VehicleField[]): FormState {
  return fields.reduce<FormState>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
}

function rowToForm(fields: VehicleField[], row: VehicleRow): FormState {
  const base = initialForm(fields);
  for (const field of fields) {
    const value = row.raw?.[field.key];
    base[field.key] = value == null ? "" : String(value);
  }
  return base;
}

function statusBadgeClass(status: string) {
  const value = status.toUpperCase();
  if (["ACTIVE", "APPROVED", "AVAILABLE"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["ASSIGNED"].includes(value)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["PENDING", "MAINTENANCE"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["REJECTED", "ACCIDENT", "CANCELLED"].includes(value)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function cardToneClass(tone?: string) {
  if (tone === "emerald") return "border-emerald-100 bg-emerald-50 text-emerald-900";
  if (tone === "amber") return "border-amber-100 bg-amber-50 text-amber-900";
  if (tone === "red") return "border-red-100 bg-red-50 text-red-900";
  if (tone === "blue") return "border-blue-100 bg-blue-50 text-blue-900";
  return "border-slate-100 bg-white text-slate-900";
}

function optionList(data: OnlineData, field: VehicleField) {
  if (field.options === "vehicles") return data.refs.vehicles.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (field.options === "drivers") return data.refs.drivers.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (field.options === "cities") return data.refs.cities.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (field.options === "rentalCompanies") return data.refs.rentalCompanies.map((item) => ({ value: item.id, label: item.label, sub: item.sub }));
  if (field.options === "vehicleStatus") return vehicleStatusOptions;
  if (field.options === "recordStatus") return statusOptions;
  if (field.options === "movementType") return movementTypeOptions;
  if (field.options === "vehicleOwnership") return vehicleOwnershipOptions;
  return [];
}

export function VehicleModernClient({ data, openCreate = false }: { data: VehicleModuleData; openCreate?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<VehicleRow | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [files, setFiles] = useState<Record<string, FileList | null>>({});
  const [error, setError] = useState("");

  const online = data.status === "online" ? data : null;
  const module = data.module;

  useEffect(() => {
    if (online && openCreate) openCreateDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate, online?.module.key]);

  const rows = useMemo(() => {
    if (!online) return [];
    const search = query.trim().toLowerCase();
    return online.rows.filter((row) => {
      const matchesSearch = !search || Object.values(row.values).join(" ").toLowerCase().includes(search);
      const matchesStatus = statusFilter === "ALL" || String(row.status).toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [online, query, statusFilter]);

  if (!online) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-bold">{module.title}</h2>
        <p className="mt-2">{data.message}</p>
      </section>
    );
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openCreateDrawer() {
    setEditingRow(null);
    setForm(initialForm(module.fields));
    setFiles({});
    setError("");
    setIsDrawerOpen(true);
  }

  function openEditDrawer(row: VehicleRow) {
    setEditingRow(row);
    setForm(rowToForm(module.fields, row));
    setFiles({});
    setError("");
    setIsDrawerOpen(true);
  }

  function applyVehicleAutoFill(current: FormState, vehicleId: string) {
    const vehicle = online.refs.vehicles.find((item) => item.id === vehicleId);
    const next = { ...current, vehicleId };

    if (vehicle?.driverId) {
      if (hasField(module.fields, "driverId")) next.driverId = vehicle.driverId;
      if (module.key === "vehicle-movements" && hasField(module.fields, "fromDriverId")) next.fromDriverId = vehicle.driverId;
    }

    if (vehicle?.cityId && hasField(module.fields, "cityId")) {
      next.cityId = vehicle.cityId;
    }

    return next;
  }

  function updateField(key: string, value: string) {
    setForm((old) => {
      if (key === "vehicleId") return applyVehicleAutoFill(old, value);
      if (module.key === "vehicle-movements" && key === "movementType") {
        const today = new Date().toISOString().slice(0, 10);
        const next = { ...old, movementType: value };
        if ((value === "تسليم" || value === "نقل من مندوب لمندوب") && hasField(module.fields, "handoverDate") && !next.handoverDate) {
          next.handoverDate = today;
        }
        if ((value === "استلام" || value === "إرجاع للشركة المالكة") && hasField(module.fields, "returnDate") && !next.returnDate) {
          next.returnDate = today;
        }
        return next;
      }
      return { ...old, [key]: value };
    });
  }

  async function saveRecord() {
    setError("");
    const url = editingRow ? `/api/${module.apiResource}/${editingRow.id}` : `/api/${module.apiResource}`;
    const method = editingRow ? "PATCH" : "POST";
    const hasFiles = module.fields.some((field) => field.type === "file" && files[field.key]?.length);

    let body: BodyInit;
    let headers: HeadersInit | undefined;

    if (hasFiles) {
      const formData = new FormData();
      for (const field of module.fields) {
        if (field.type === "file") {
          const selectedFiles = files[field.key];
          if (selectedFiles) Array.from(selectedFiles).forEach((file) => formData.append(field.key, file));
        } else {
          formData.append(field.key, form[field.key] ?? "");
        }
      }
      body = formData;
    } else {
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify(form);
    }

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      let message = "تعذر حفظ السجل";
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch {
        message = await response.text();
      }
      setError(message);
      return;
    }

    setIsDrawerOpen(false);
    refresh();
  }

  async function deleteRecord(row: VehicleRow) {
    if (!confirm("هل تريد حذف هذا السجل؟")) return;
    const response = await fetch(`/api/${module.apiResource}/${row.id}`, { method: "DELETE" });
    if (!response.ok) {
      alert("تعذر حذف السجل");
      return;
    }
    refresh();
  }

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">منظومة السيارات والحركة</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{module.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{module.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {online.modules.map((item) => (
              <Link
                key={item.key}
                href={item.route}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  item.key === module.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {online.summary.map((item) => (
          <div key={item.label} className={`rounded-3xl border p-4 shadow-sm ${cardToneClass(item.tone)}`}>
            <p className="text-sm opacity-75">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث باللوحة / المندوب / المدينة / الحالة..."
              className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">كل الحالات</option>
              {[...new Set(online.rows.map((row) => String(row.status).toUpperCase()).filter(Boolean))].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            + {module.addLabel}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {module.columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-4 py-3 font-bold">{column.label}</th>
                ))}
                <th className="whitespace-nowrap px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={module.columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                    لا توجد سجلات مطابقة.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {module.columns.map((column) => {
                      const value = row.values[column.key] ?? "-";
                      const isStatus = column.key.toLowerCase().includes("status") || column.key === "statusLabel";
                      return (
                        <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-800">
                          {isStatus ? <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusBadgeClass(row.status)}`}>{value}</span> : value}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        {module.key === "vehicles" && (
                          <Link href={`/vehicles/${row.id}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            ملف السيارة
                          </Link>
                        )}
                        <button type="button" onClick={() => openEditDrawer(row)} className="rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">
                          تعديل
                        </button>
                        <button type="button" onClick={() => deleteRecord(row)} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}>
          <div className="mr-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{editingRow ? "تعديل السجل" : module.addLabel}</h2>
                  <p className="mt-1 text-sm text-slate-500">{module.description}</p>
                </div>
                <button type="button" onClick={() => setIsDrawerOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
                  إغلاق
                </button>
              </div>
              {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
              {module.fields.map((field) => (
                <label key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                  <span className="mb-1 block text-sm font-bold text-slate-700">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </span>
                  {field.type === "select" ? (
                    <select
                      value={form[field.key] ?? ""}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">اختر</option>
                      {optionList(online, field).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}{option.sub ? ` - ${option.sub}` : ""}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={form[field.key] ?? ""}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
                    />
                  ) : field.type === "file" ? (
                    <input
                      type="file"
                      accept={field.accept}
                      multiple={field.multiple}
                      onChange={(event) => setFiles((old) => ({ ...old, [field.key]: event.target.files }))}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={form[field.key] ?? ""}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-5">
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">
                إلغاء
              </button>
              <button type="button" onClick={saveRecord} disabled={isPending} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
