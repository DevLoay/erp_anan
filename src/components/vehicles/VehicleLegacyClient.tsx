"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
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
  { value: "CANCELLED", label: "ملغي" },
  { value: "DEDUCTED", label: "مخصوم" },
  { value: "PARTIALLY_DEDUCTED", label: "مخصوم جزئيًا" },
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

const moduleGroups = [
  {
    title: "الأساسيات",
    items: ["vehicles", "rental-companies", "vehicle-movements", "vehicle-authorizations"],
  },
  {
    title: "التشغيل",
    items: ["vehicle-maintenance", "vehicle-cleaning", "vehicle-accidents", "vehicle-damages"],
  },
  {
    title: "المالية",
    items: ["vehicle-deductions", "vehicle-violations", "vehicle-costs", "vehicle-finance"],
  },
];

function statusClass(status: string) {
  const raw = String(status ?? "").toLowerCase();
  if (raw.includes("متاحة") || raw.includes("نشط") || raw.includes("معتمد") || raw.includes("available") || raw.includes("active") || raw.includes("approved")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (raw.includes("مندوب") || raw.includes("assigned")) return "border-blue-200 bg-blue-50 text-blue-800";
  if (raw.includes("صيانة") || raw.includes("مراجعة") || raw.includes("pending") || raw.includes("maintenance")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (raw.includes("حادث") || raw.includes("موقوف") || raw.includes("مرفوض") || raw.includes("accident") || raw.includes("inactive") || raw.includes("rejected") || raw.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function summaryToneClass(tone: string | undefined) {
  if (tone === "emerald") return "from-emerald-50 to-white text-emerald-800 border-emerald-100";
  if (tone === "amber") return "from-amber-50 to-white text-amber-800 border-amber-100";
  if (tone === "red") return "from-red-50 to-white text-red-800 border-red-100";
  if (tone === "blue") return "from-blue-50 to-white text-blue-800 border-blue-100";
  return "from-slate-50 to-white text-slate-950 border-slate-200";
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
  return `تم تعبئة المندوب والمدينة تلقائيًا من السيارة: ${driver} / ${city}`;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function lowerText(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function rowTitle(row: VehicleRow) {
  return (
    row.values.plate ||
    row.values.vehicle ||
    row.values.name ||
    row.values.driver ||
    row.values.authNumber ||
    row.values.type ||
    row.values.month ||
    row.id
  );
}

function rowSubtitle(row: VehicleRow) {
  return [
    row.values.driverName || row.values.driver,
    row.values.cityName,
    row.values.rentalCompany,
    row.values.statusLabel,
  ]
    .filter(Boolean)
    .join(" • ");
}

function parseNumber(input: unknown) {
  const number = Number(String(input ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function moduleIcon(key: string) {
  if (key.includes("finance") || key.includes("cost") || key.includes("deductions") || key.includes("violations")) return "﷼";
  if (key.includes("maintenance")) return "ص";
  if (key.includes("accidents") || key.includes("damages")) return "!";
  if (key.includes("cleaning")) return "ن";
  if (key.includes("movements")) return "↔";
  if (key.includes("authorizations")) return "ت";
  if (key.includes("rental")) return "ش";
  return "🚗";
}

function getRowValue(row: VehicleRow, keys: string[]) {
  for (const key of keys) {
    const value = row.values[key] ?? row.raw[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "";
}

function quickInsights(data: OnlineData) {
  if (data.module.key === "vehicles") {
    const available = data.rows.filter((row) => lowerText(row.status).includes("available") || lowerText(row.values.statusLabel).includes("متاحة")).length;
    const assigned = data.rows.filter((row) => lowerText(row.status).includes("assigned") || lowerText(row.values.statusLabel).includes("مندوب")).length;
    const maintenance = data.rows.filter((row) => lowerText(row.status).includes("maintenance") || lowerText(row.values.statusLabel).includes("صيانة")).length;
    const missingDriver = data.rows.filter((row) => !normalizeText(row.values.driverName) || normalizeText(row.values.driverName) === "-").length;
    return [
      { label: "متاحة", value: String(available), tone: "emerald" },
      { label: "مع مندوب", value: String(assigned), tone: "blue" },
      { label: "في الصيانة", value: String(maintenance), tone: "amber" },
      { label: "بدون مندوب", value: String(missingDriver), tone: missingDriver ? "red" : "slate" },
    ];
  }

  if (data.module.key === "vehicle-finance" || data.module.key === "vehicle-costs") {
    const total = data.rows.reduce((sum, row) => sum + parseNumber(row.raw.totalCost ?? row.values.totalCost), 0);
    const rent = data.rows.reduce((sum, row) => sum + parseNumber(row.raw.rentCost ?? row.values.rentCost), 0);
    return [
      { label: "عدد السجلات", value: String(data.rows.length), tone: "blue" },
      { label: "إجمالي التكلفة", value: total.toLocaleString("ar-SA"), tone: "red" },
      { label: "إجمالي الإيجار", value: rent.toLocaleString("ar-SA"), tone: "amber" },
      { label: "المتوسط", value: data.rows.length ? Math.round(total / data.rows.length).toLocaleString("ar-SA") : "0", tone: "slate" },
    ];
  }

  const pending = data.rows.filter((row) => lowerText(row.status).includes("pending") || lowerText(row.values.statusLabel).includes("مراجعة")).length;
  const approved = data.rows.filter((row) => lowerText(row.status).includes("approved") || lowerText(row.values.statusLabel).includes("معتمد")).length;
  return [
    { label: "كل السجلات", value: String(data.rows.length), tone: "blue" },
    { label: "قيد المراجعة", value: String(pending), tone: pending ? "amber" : "slate" },
    { label: "معتمد", value: String(approved), tone: "emerald" },
  ];
}

export function VehicleLegacyClient({ data, openCreate = false }: { data: VehicleModuleData; openCreate?: boolean }) {
  if (data.status === "offline") {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-right shadow-sm" dir="rtl">
        <p className="text-sm font-black text-amber-700">تعذر الاتصال</p>
        <h1 className="mt-2 text-2xl font-black text-amber-950">{data.module.title}</h1>
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
  const [city, setCity] = useState("all");
  const [rentalCompany, setRentalCompany] = useState("all");
  const [selected, setSelected] = useState<VehicleRow | null>(null);
  const [formOpen, setFormOpen] = useState(openCreate);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(initialForm(data.module.fields));

  const insights = useMemo(() => quickInsights(data), [data]);

  const statusFilterOptions = useMemo(() => {
    const baseOptions = data.module.key === "vehicles" ? vehicleStatusOptions : statusOptions;
    const rowOptions = data.rows
      .map((row) => ({
        value: normalizeText(row.status || row.values.statusLabel),
        label: normalizeText(row.values.statusLabel || row.status),
      }))
      .filter((option) => option.value && option.label);

    return uniqueOptions([...baseOptions, ...rowOptions]);
  }, [data.module.key, data.rows]);

  const cityOptions = useMemo(() => {
    return uniqueOptions(
      data.rows
        .map((row) => {
          const label = getRowValue(row, ["cityName", "city", "cityLabel"]);
          return { value: label, label };
        })
        .filter((option) => option.value),
    );
  }, [data.rows]);

  const rentalCompanyOptions = useMemo(() => {
    return uniqueOptions(
      data.rows
        .map((row) => {
          const label = getRowValue(row, ["rentalCompany", "rentalCompanyName"]);
          return { value: label, label };
        })
        .filter((option) => option.value),
    );
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      const values = [...Object.values(row.values), ...Object.values(row.raw)];
      const textMatch = needle ? values.some((value) => String(value ?? "").toLowerCase().includes(needle)) : true;
      const statusMatch = status === "all" ? true : String(row.status).toUpperCase() === status.toUpperCase() || row.values.statusLabel === status;
      const cityMatch = city === "all" ? true : getRowValue(row, ["cityName", "city", "cityLabel"]) === city;
      const rentalMatch = rentalCompany === "all" ? true : getRowValue(row, ["rentalCompany", "rentalCompanyName"]) === rentalCompany;
      return textMatch && statusMatch && cityMatch && rentalMatch;
    });
  }, [data.rows, query, status, city, rentalCompany]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, status, city, rentalCompany, pageSize, data.rows.length]);

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

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    const formElement = event.currentTarget;
    const fileInputs = Array.from(formElement.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    const hasFileInputs = fileInputs.length > 0;
    const url = selected ? `/api/${data.module.apiResource}/${selected.id}` : `/api/${data.module.apiResource}`;
    const method = selected ? "PATCH" : "POST";

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
    setSelected(null);
    startTransition(() => router.refresh());
  }

  function exportRows() {
    const headers = data.module.columns.map((column) => column.key);
    downloadCsv(`${data.module.key}.csv`, headers, filteredRows);
    setNotice("تم تجهيز ملف CSV من البيانات المعروضة.");
  }

  async function recalculateVehicleCosts() {
    setNotice("جاري تجميع تكاليف السيارات...");
    const response = await fetch("/api/vehicle-costs/recalculate", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.error || "تعذر تحديث ملخص تكاليف السيارات.");
      return;
    }
    setNotice(`تم تحديث ملخص تكاليف السيارات. عدد السجلات: ${result.count ?? 0}`);
    startTransition(() => router.refresh());
  }

  function printPage() {
    window.print();
  }

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setCity("all");
    setRentalCompany("all");
  }

  return (
    <section className="space-y-5 text-right" dir="rtl">
      {notice ? (
        <div className="fixed left-5 top-24 z-[90] max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-emerald-700">✓</span>
            <p className="flex-1 leading-6">{notice}</p>
            <button type="button" onClick={() => setNotice("")} className="rounded-lg bg-slate-100 px-2 py-1 text-xs">
              إغلاق
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-[#16365f] via-[#214a7a] to-slate-950 text-white shadow-sm">
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-50 ring-1 ring-white/10">
                <span>{moduleIcon(data.module.key)}</span>
                منظومة السيارات
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">{data.module.title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-blue-50">{data.module.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={printPage} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/15 hover:bg-white/15">
                طباعة / PDF
              </button>
              {(data.module.key === "vehicle-finance" || data.module.key === "vehicle-costs") ? (
                <button type="button" onClick={recalculateVehicleCosts} className="rounded-2xl bg-indigo-400 px-4 py-2 text-sm font-black text-slate-950 shadow-sm">
                  تحديث التكاليف
                </button>
              ) : null}
              <button type="button" onClick={exportRows} className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 shadow-sm">
                تصدير CSV
              </button>
              <button type="button" onClick={openAdd} className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 shadow-sm">
                + {data.module.addLabel}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {insights.map((item) => (
              <SummaryCard key={item.label} label={item.label} value={item.value} tone={item.tone} compact />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.summary.slice(0, 8).map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-3">
          {moduleGroups.map((group) => {
            const modules = group.items
              .map((key) => data.modules.find((module) => module.key === key))
              .filter(Boolean) as OnlineData["modules"];
            if (!modules.length) return null;
            return (
              <div key={group.title} className="rounded-2xl bg-slate-50 p-3">
                <p className="mb-2 px-1 text-[11px] font-black text-slate-500">{group.title}</p>
                <div className="flex flex-wrap gap-2">
                  {modules.map((module) => (
                    <Link
                      key={module.key}
                      href={module.route}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                        module.key === data.module.key
                          ? "bg-[#16365f] text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      <span className="ml-1">{moduleIcon(module.key)}</span>
                      {module.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <label className="grid gap-1 text-xs font-black text-slate-800 lg:col-span-4" htmlFor="vehicle-search">
            بحث سريع
            <input
              id="vehicle-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث باللوحة / المندوب / المدينة / الحالة"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <SelectFilter id="vehicle-status" label="الحالة" value={status} onChange={setStatus} options={statusFilterOptions} />
          <SelectFilter id="vehicle-city" label="المدينة" value={city} onChange={setCity} options={cityOptions} disabled={!cityOptions.length} />
          <SelectFilter id="vehicle-company" label="شركة التأجير" value={rentalCompany} onChange={setRentalCompany} options={rentalCompanyOptions} disabled={!rentalCompanyOptions.length} />

          <label className="grid gap-1 text-xs font-black text-slate-800 lg:col-span-1" htmlFor="vehicle-page-size">
            الصفوف
            <select id="vehicle-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold">
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2 lg:col-span-2">
            <button type="button" onClick={resetFilters} className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 hover:bg-slate-50">
              تصفير
            </button>
            <button type="button" onClick={exportRows} className="h-11 flex-1 rounded-2xl bg-blue-600 px-3 text-sm font-black text-white shadow-sm">
              تصدير
            </button>
          </div>
        </div>
      </div>

      {selected ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-700">السجل المحدد</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{rowTitle(selected)}</h2>
              <p className="mt-1 text-xs font-bold text-slate-600">{rowSubtitle(selected) || selected.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.module.key === "vehicles" ? (
                <Link href={`/vehicles/${selected.id}`} className="rounded-xl bg-[#16365f] px-4 py-2 text-sm font-black text-white">
                  فتح ملف السيارة
                </Link>
              ) : null}
              <button type="button" onClick={() => openEdit(selected)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
                تعديل
              </button>
              <button type="button" onClick={() => deleteRow(selected)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">
                حذف
              </button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
                إلغاء التحديد
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-black text-slate-950">البيانات</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              المعروض: {filteredRows.length.toLocaleString("ar-SA")} من {data.rows.length.toLocaleString("ar-SA")} سجل
              {isPending ? " • جاري التحديث..." : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/imports/preview?importType=vehicles" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800">
              استيراد Excel / PDF
            </Link>
            {(data.module.key === "vehicle-finance" || data.module.key === "vehicle-costs") ? (
              <button type="button" onClick={recalculateVehicleCosts} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">
                تحديث التكاليف
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-600">
              <tr>
                <th className="w-12 px-3 py-3">اختيار</th>
                {data.module.columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-3 py-3">{column.label}</th>
                ))}
                <th className="whitespace-nowrap px-3 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRows.length ? (
                pagedRows.map((row) => (
                  <tr key={row.id} className={`transition hover:bg-slate-50 ${selected?.id === row.id ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3">
                      <input aria-label="اختيار السجل" type="checkbox" checked={selected?.id === row.id} onChange={() => setSelected(selected?.id === row.id ? null : row)} />
                    </td>
                    {data.module.columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap px-3 py-3 font-bold text-slate-900">
                        <CellValue columnKey={column.key} value={row.values[column.key]} />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {data.module.key === "vehicles" ? (
                          <Link href={`/vehicles/${row.id}`} className="rounded-lg bg-[#16365f] px-3 py-1.5 text-xs font-black text-white">
                            ملف السيارة
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
                  <td colSpan={data.module.columns.length + 2} className="px-4 py-14 text-center">
                    <div className="mx-auto max-w-sm rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                      <p className="text-lg font-black text-slate-900">لا توجد بيانات مطابقة</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">جرّب تصفير الفلاتر أو إضافة سجل جديد.</p>
                      <button type="button" onClick={openAdd} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">
                        + {data.module.addLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((old) => Math.max(1, old - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((old) => Math.min(pageCount, old + 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالي
            </button>
          </div>
          <span>صفحة {currentPage} / {pageCount}</span>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/50 p-3 backdrop-blur-sm">
          <form onSubmit={submitForm} className="mr-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-blue-700">{selected ? "تعديل سجل" : "إضافة سجل جديد"}</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{formTitle}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">اختيار السيارة يعبّي المندوب والمدينة تلقائيًا عند توفر الربط.</p>
                </div>
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black">
                  إغلاق
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {form.vehicleId ? (
                <VehicleAutoFillPanel vehicle={selectedVehicleRef(data.refs, form.vehicleId)} />
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
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
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-white p-4">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-black">
                إلغاء
              </button>
              <button type="submit" className="rounded-2xl bg-emerald-600 px-6 py-2 text-sm font-black text-white shadow-sm">
                حفظ البيانات
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value, tone, compact }: { label: string; value: string; tone?: string; compact?: boolean }) {
  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${summaryToneClass(tone)}`}>
      <p className="text-xs font-black opacity-70">{label}</p>
      <strong className={`${compact ? "text-2xl" : "text-3xl"} mt-2 block font-black`}>{value}</strong>
    </div>
  );
}

function SelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-black text-slate-800 lg:col-span-2" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="all">الكل</option>
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function CellValue({ columnKey, value }: { columnKey: string; value: string }) {
  if (columnKey === "statusLabel" || columnKey.includes("Status")) {
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(value)}`}>{value || "-"}</span>;
  }
  if (columnKey.toLowerCase().includes("count") || columnKey.toLowerCase().includes("attachments")) {
    return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{value || "-"}</span>;
  }
  return <>{value || "-"}</>;
}

function VehicleAutoFillPanel({ vehicle }: { vehicle?: OnlineData["refs"]["vehicles"][number] }) {
  if (!vehicle) return null;
  return (
    <div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
      <p className="text-xs font-black text-blue-700">بيانات السيارة المختارة</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniInfo label="السيارة" value={vehicle.label} />
        <MiniInfo label="المندوب الحالي" value={vehicle.driverLabel || "غير مرتبط"} />
        <MiniInfo label="المدينة" value={vehicle.cityLabel || "غير محددة"} />
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
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
  const baseClass = "h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50";
  const fieldIsWide = field.type === "textarea" || field.type === "file" || field.key === "notes";
  const label = (
    <span>
      {field.label} {field.required ? <span className="text-red-600">*</span> : null}
    </span>
  );

  let input: ReactNode;
  if (field.type === "textarea") {
    input = <textarea name={field.key} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-500" />;
  } else if (field.type === "file") {
    input = (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
        <input
          name={field.key}
          type="file"
          accept={field.accept}
          multiple={field.multiple ?? true}
          required={Boolean(field.required && !isEditing)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
        />
        <p className="mt-2 text-[11px] font-bold text-slate-500">
          {field.accept?.includes("image") ? "ارفع صورة واضحة للسيارة كإثبات." : "ارفع صور أو PDF كمرفقات إثبات."}
        </p>
      </div>
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
    <label className={`grid gap-1 text-xs font-black text-slate-800 ${fieldIsWide ? "md:col-span-2" : ""}`}>
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
