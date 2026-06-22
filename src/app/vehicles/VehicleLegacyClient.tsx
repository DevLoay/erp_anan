"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VehicleField, VehicleModuleData, VehicleRow } from "@/lib/vehicles/vehicleModuleData";

type OnlineData = Extract<VehicleModuleData, { status: "online" }>;

const statusOptions = [
  { value: "ACTIVE", label: "نشط" },
  { value: "PENDING", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "LOCKED", label: "مقفل" },
  { value: "INACTIVE", label: "غير نشط" },
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

function statusClass(status: string) {
  const raw = status.toLowerCase();
  if (raw.includes("متاحة") || raw.includes("نشط") || raw.includes("معتمد") || raw.includes("available") || raw.includes("active") || raw.includes("approved")) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (raw.includes("صيانة") || raw.includes("مراجعة") || raw.includes("pending") || raw.includes("maintenance")) return "bg-amber-100 text-amber-800";
  if (raw.includes("حادث") || raw.includes("موقوف") || raw.includes("مرفوض") || raw.includes("accident") || raw.includes("inactive") || raw.includes("rejected")) return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

function summaryToneClass(tone: string | undefined) {
  if (tone === "emerald") return "text-emerald-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "red") return "text-red-700";
  if (tone === "blue") return "text-blue-700";
  return "text-slate-950";
}

function uniqueOptions(options: { value: string; label: string }[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.value.trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function csvEscape(input: unknown) {
  const value = String(input ?? "");
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, headers: string[], rows: VehicleRow[]) {
  const body = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row.values[header] ?? row.raw[header] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function initialForm(fields: VehicleField[], row?: VehicleRow | null) {
  return Object.fromEntries(fields.map((field) => [field.key, String(row?.raw[field.key] ?? "")]));
}

function hasField(fields: VehicleField[], key: string) {
  return fields.some((field) => field.key === key);
}

function selectedVehicleRef(refs: OnlineData["refs"], vehicleId: string) {
  return refs.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

function vehicleAutoFillNotice(refs: OnlineData["refs"], vehicleId: string) {
  const vehicle = selectedVehicleRef(refs, vehicleId);
  if (!vehicle) return "";
  const driver = vehicle.driverLabel || "لا يوجد مندوب مرتبط";
  const city = vehicle.cityLabel || "لا توجد مدينة مرتبطة";
  return `تم ربط المندوب والمدينة تلقائيًا من السيارة: ${driver} / ${city}`;
}

export function VehicleLegacyClient({ data, openCreate = false }: { data: VehicleModuleData; openCreate?: boolean }) {
  if (data.status === "offline") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-right shadow-sm" dir="rtl">
        <h1 className="text-2xl font-black text-amber-900">{data.module.title}</h1>
        <p className="mt-2 text-sm font-bold text-amber-800">{data.message}</p>
      </section>
    );
  }

  return <VehicleOnlineClient data={data} openCreate={openCreate} />;
}

function VehicleOnlineClient({ data, openCreate }: { data: OnlineData; openCreate: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<VehicleRow | null>(null);
  const [formOpen, setFormOpen] = useState(openCreate);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(initialForm(data.module.fields));
  const statusFilterOptions = useMemo(() => {
    const baseOptions = data.module.key === "vehicles" ? vehicleStatusOptions : statusOptions;
    const rowOptions = data.rows
      .map((row) => ({
        value: String(row.status || row.values.statusLabel || "").trim(),
        label: String(row.values.statusLabel || row.status || "").trim(),
      }))
      .filter((option) => option.value && option.label);

    return uniqueOptions([...baseOptions, ...rowOptions]);
  }, [data.module.key, data.rows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      const textMatch = needle
        ? [...Object.values(row.values), ...Object.values(row.raw)].some((value) => String(value ?? "").toLowerCase().includes(needle))
        : true;
      const statusMatch = status === "all" ? true : String(row.status).toUpperCase() === status.toUpperCase() || row.values.statusLabel === status;
      return textMatch && statusMatch;
    });
  }, [data.rows, query, status]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, status, pageSize, data.rows.length]);

  const formTitle = selected ? `تعديل ${data.module.title}` : data.module.addLabel;

  function applyVehicleAutoFill(old: Record<string, string>, vehicleId: string) {
    const vehicle = selectedVehicleRef(data.refs, vehicleId);
    const next = { ...old, vehicleId };

    if (vehicle?.driverId) {
      if (hasField(data.module.fields, "driverId")) next.driverId = vehicle.driverId;
      if (data.module.key === "vehicle-movements" && hasField(data.module.fields, "fromDriverId")) next.fromDriverId = vehicle.driverId;
    } else {
      if (hasField(data.module.fields, "driverId")) next.driverId = "";
      if (data.module.key === "vehicle-movements" && hasField(data.module.fields, "fromDriverId")) next.fromDriverId = "";
    }

    if (vehicle?.cityId && hasField(data.module.fields, "cityId")) {
      next.cityId = vehicle.cityId;
    } else if (hasField(data.module.fields, "cityId")) {
      next.cityId = "";
    }

    return next;
  }

  function updateFormField(key: string, value: string) {
    setForm((old) => {
      if (key === "vehicleId") return applyVehicleAutoFill(old, value);
      if (data.module.key === "vehicle-movements" && key === "movementType") {
        const next = { ...old, movementType: value };
        const today = new Date().toISOString().slice(0, 10);
        if ((value === "تسليم" || value === "نقل من مندوب لمندوب" || value === "دخول صيانة" || value === "خروج من صيانة") && !next.handoverDate) {
          next.handoverDate = today;
        }
        if ((value === "استلام" || value === "إرجاع للشركة المالكة") && !next.returnDate) {
          next.returnDate = today;
        }
        if ((value === "استلام" || value === "دخول صيانة" || value === "خروج من صيانة" || value === "إرجاع للشركة المالكة") && hasField(data.module.fields, "toDriverId")) {
          next.toDriverId = "";
        }
        return next;
      }
      return { ...old, [key]: value };
    });

    if (key === "vehicleId" && value) {
      const message = vehicleAutoFillNotice(data.refs, value);
      if (message) setNotice(message);
    }
  }

  function isAutoFilledField(field: VehicleField) {
    const vehicle = selectedVehicleRef(data.refs, form.vehicleId || "");
    if (!vehicle) return false;
    if (field.key === "driverId" && Boolean(vehicle.driverId)) return true;
    if (field.key === "cityId" && Boolean(vehicle.cityId)) return true;
    if (data.module.key === "vehicle-movements" && field.key === "fromDriverId" && Boolean(vehicle.driverId)) return true;
    return false;
  }

  function openAdd() {
    setSelected(null);
    setForm(initialForm(data.module.fields));
    setFormOpen(true);
  }

  function openEdit(row: VehicleRow) {
    setSelected(row);
    setForm(initialForm(data.module.fields, row));
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    const formElement = event.currentTarget;
    const fileInputs = Array.from(formElement.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    const hasFileInputs = fileInputs.length > 0;
    const url = selected ? `/api/${data.module.apiResource}/${selected.id}` : `/api/${data.module.apiResource}`;
    const method = selected ? "PATCH" : "POST";

    // أي صفحة فيها input file لازم تتبعت FormData، بدون إضافة Content-Type يدويًا.
    // المتصفح هو اللي بيحط multipart/form-data + boundary.
    const response = hasFileInputs
      ? await fetch(url, { method, body: new FormData(formElement) })
      : await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ""))),
        });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.error || "تعذر حفظ البيانات. راجع الحقول والصلاحيات.");
      return;
    }
    setNotice(selected ? "تم تعديل السجل بنجاح." : "تم حفظ السجل بنجاح.");
    setFormOpen(false);
    setSelected(null);
    startTransition(() => router.refresh());
  }

  async function deleteRow(row: VehicleRow) {
    setNotice("");
    const confirmed = window.confirm("تأكيد تنفيذ الحذف/التعطيل الآمن لهذا السجل؟");
    if (!confirmed) return;
    const response = await fetch(`/api/${data.module.apiResource}/${row.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.error || "تعذر تنفيذ العملية. قد تحتاج صلاحية المدير.");
      return;
    }
    setNotice("تم تنفيذ العملية بنجاح.");
    startTransition(() => router.refresh());
  }

  function exportRows() {
    const headers = data.module.columns.map((column) => column.key);
    downloadCsv(`${data.module.key}.csv`, headers, filteredRows);
    setNotice("تم تجهيز ملف CSV من البيانات المعروضة.");
  }

  function printPage() {
    window.print();
  }

  return (
    <section className="space-y-4 text-right" dir="rtl">
      {notice ? (
        <div className="fixed left-5 top-24 z-[80] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-2xl">
          {notice}
          <button type="button" onClick={() => setNotice("")} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs">
            إغلاق
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">{data.module.title}</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">{data.module.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={printPage} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm">
              طباعة / PDF
            </button>
            <button type="button" onClick={exportRows} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm">
              تصدير إكسل
            </button>
            <button type="button" onClick={() => selected ? deleteRow(selected) : setNotice("اختر سجلًا من الجدول أولًا ثم اضغط حذف.")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm">
              حذف
            </button>
            <button type="button" onClick={() => selected ? openEdit(selected) : setNotice("اختر سجلًا من الجدول أولًا ثم اضغط تعديل.")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm">
              تعديل
            </button>
            <Link href="/imports/preview?importType=vehicles" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm">
              استيراد Excel / PDF
            </Link>
            <button type="button" onClick={openAdd} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm">
              + {data.module.addLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {data.summary.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black text-slate-500">{item.label}</p>
            <strong className={`mt-2 block text-2xl font-black ${summaryToneClass(item.tone)}`}>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {data.modules.map((module) => (
            <Link
              key={module.key}
              href={module.route}
              className={`rounded-xl px-4 py-2 text-sm font-black shadow-sm ${
                module.key === data.module.key ? "bg-[#16365f] text-white" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {module.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="grid gap-1 text-xs font-black text-slate-800 md:col-span-2" htmlFor="vehicle-search">
            بحث
            <input
              id="vehicle-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث باللوحة / الموديل / المندوب / الحالة"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="vehicle-status">
            الحالة
            <select id="vehicle-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="all">كل الحالات</option>
              {statusFilterOptions.map((option, index) => (
                <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="vehicle-page-size">
            عدد الصفوف
            <select id="vehicle-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>{size} صف</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black">
              عرض الكل
            </button>
            <button type="button" onClick={exportRows} className="h-11 flex-1 rounded-xl bg-blue-600 px-3 text-sm font-black text-white">
              تصدير
            </button>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={openAdd} className="h-11 w-full rounded-xl bg-emerald-600 px-3 text-sm font-black text-white">
              + {data.module.addLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input aria-label="تحديد" type="checkbox" disabled />
                </th>
                {data.module.columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-3 py-3">{column.label}</th>
                ))}
                <th className="whitespace-nowrap px-3 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length ? (
                pagedRows.map((row) => (
                  <tr key={row.id} className={`border-b border-slate-100 ${selected?.id === row.id ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3">
                      <input aria-label="اختيار السجل" type="checkbox" checked={selected?.id === row.id} onChange={() => setSelected(selected?.id === row.id ? null : row)} />
                    </td>
                    {data.module.columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap px-3 py-3 font-bold text-slate-900">
                        {column.key === "statusLabel" ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.values[column.key])}`}>{row.values[column.key]}</span>
                        ) : (
                          row.values[column.key] || "-"
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {data.module.key === "vehicles" ? (
                          <Link href={`/vehicles/${row.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800">
                            فتح
                          </Link>
                        ) : null}
                        <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800">
                          تعديل
                        </button>
                        <button type="button" onClick={() => deleteRow(row)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={data.module.columns.length + 2} className="px-4 py-10 text-center text-sm font-black text-slate-500">
                    لا توجد بيانات مطابقة حاليًا.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 px-2 py-3 text-xs font-bold text-slate-500">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((old) => Math.max(1, old - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((old) => Math.min(pageCount, old + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
          <span>صفحة {currentPage} / {pageCount} | عدد السجلات: {filteredRows.length} / {data.rows.length}</span>
          {isPending ? <span>جاري التحديث...</span> : null}
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={submitForm} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{formTitle}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">كل الحقول تحفظ مباشرة في قاعدة البيانات بعد التأكيد.</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">
                إغلاق
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.module.fields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={form[field.key] ?? ""}
                  refs={data.refs}
                  isEditing={Boolean(selected)}
                  disabled={isAutoFilledField(field)}
                  onChange={(value) => updateFormField(field.key, value)}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black">
                إلغاء
              </button>
              <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white">
                حفظ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function FormField({
  field,
  value,
  refs,
  isEditing,
  disabled,
  onChange,
}: {
  field: VehicleField;
  value: string;
  refs: OnlineData["refs"];
  isEditing?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const baseClass = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold";
  const label = (
    <span>
      {field.label} {field.required ? <span className="text-red-600">*</span> : null}
    </span>
  );

  let input: React.ReactNode;
  if (field.type === "textarea") {
    input = <textarea name={field.key} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:bg-slate-100 disabled:text-slate-500" />;
  } else if (field.type === "file") {
    input = (
      <input
        name={field.key}
        type="file"
        accept={field.accept}
        multiple={field.multiple ?? true}
        required={Boolean(field.required && !isEditing)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
      />
    );
  } else if (field.type === "select") {
    input = (
      <>
        {disabled ? <input type="hidden" name={field.key} value={value} /> : null}
        <select name={field.key} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={`${baseClass} disabled:bg-slate-100 disabled:text-slate-500`}>
          <option value="">اختر</option>
          {optionsFor(field.options, refs).map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
          ))}
        </select>
        {disabled ? <span className="text-[11px] font-bold text-emerald-700">تم تعبئته تلقائيًا من السيارة المختارة</span> : null}
      </>
    );
  } else {
    input = (
      <>
        {disabled ? <input type="hidden" name={field.key} value={value} /> : null}
        <input name={field.key} value={value} onChange={(event) => onChange(event.target.value)} type={field.type} disabled={disabled} className={`${baseClass} disabled:bg-slate-100 disabled:text-slate-500`} required={field.required} />
        {disabled ? <span className="text-[11px] font-bold text-emerald-700">تم تعبئته تلقائيًا من السيارة المختارة</span> : null}
      </>
    );
  }

  return (
    <label className={`grid gap-1 text-xs font-black text-slate-800 ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
      {label}
      {input}
    </label>
  );
}

function optionsFor(key: string | undefined, refs: OnlineData["refs"]) {
  if (key === "vehicles") return refs.vehicles.map((item) => ({ value: item.id, label: item.sub ? `${item.label} - ${item.sub}` : item.label }));
  if (key === "drivers") return refs.drivers.map((item) => ({ value: item.id, label: item.sub ? `${item.label} - ${item.sub}` : item.label }));
  if (key === "cities") return refs.cities.map((item) => ({ value: item.id, label: item.label }));
  if (key === "rentalCompanies") return refs.rentalCompanies.map((item) => ({ value: item.id, label: item.sub ? `${item.label} - ${item.sub}` : item.label }));
  if (key === "vehicleStatus") return vehicleStatusOptions;
  if (key === "recordStatus") return statusOptions;
  if (key === "movementType") return movementTypeOptions;
  if (key === "vehicleOwnership") return vehicleOwnershipOptions;
  return [];
}
