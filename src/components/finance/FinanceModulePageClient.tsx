"use client";

import Link from "next/link";
import { useMemo, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FinanceModulePageData, FinanceOverviewData, FinanceRow } from "@/lib/finance/financePages";

type ModuleProps = {
  data: FinanceModulePageData;
};

type OverviewProps = {
  data: FinanceOverviewData;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  PENDING: "قيد الانتظار",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  LOCKED: "مقفل",
  CANCELLED: "ملغي",
  DEDUCTED: "تم الخصم",
  PARTIALLY_DEDUCTED: "خصم جزئي",
  DRAFT: "مسودة",
  UNDER_REVIEW: "تحت المراجعة",
  PAID: "مدفوع",
  Approved: "معتمد",
  Locked: "مقفل",
  Paid: "مدفوع",
  Draft: "مسودة",
  Uploaded: "مرفوع",
  Reviewed: "تمت المراجعة",
};

const statusOptions = [
  { value: "", label: "كل الحالات" },
  { value: "ACTIVE", label: "نشط" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "APPROVED", label: "معتمد" },
  { value: "LOCKED", label: "مقفل" },
  { value: "PAID", label: "مدفوع" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "DRAFT", label: "مسودة" },
  { value: "UNDER_REVIEW", label: "تحت المراجعة" },
];

const financeShortcuts = [
  { href: "/finance", label: "المركز" },
  { href: "/payroll", label: "المسير" },
  { href: "/invoices", label: "الفواتير" },
  { href: "/receivables", label: "المستحقات" },
  { href: "/payments", label: "المدفوعات" },
  { href: "/expenses", label: "المصروفات" },
  { href: "/revenues", label: "الإيرادات" },
  { href: "/advances", label: "السلف" },
  { href: "/deductions", label: "الخصومات" },
  { href: "/vehicle-finance", label: "سيارات" },
  { href: "/supplier-accounts", label: "موردين" },
  { href: "/custody-cashbox", label: "الصندوق" },
  { href: "/bank-accounts", label: "البنوك" },
  { href: "/vat", label: "VAT" },
  { href: "/profit-loss", label: "أ.خ" },
  { href: "/financial-reports", label: "تقارير" },
];

function FinanceQuickNav({ current }: { current: string }) {
  return (
    <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm print:hidden" aria-label="روابط الماليات السريعة">
      <div className="flex min-w-max gap-2">
        {financeShortcuts.map((item) => {
          const active = current === item.href || (current === "/vehicle-finance" && item.href === "/vehicle-finance");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl border px-3 py-2 text-xs font-black transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const fieldLabels: Record<string, string> = {
  number: "رقم الفاتورة",
  client: "العميل",
  applicationProjectId: "المشروع",
  month: "الشهر",
  amount: "المبلغ",
  vatAmount: "VAT",
  invoiceStatus: "حالة الفاتورة",
  status: "الحالة",
  issuedAt: "تاريخ الإصدار",
  dueDate: "تاريخ الاستحقاق",
  paidAmount: "المدفوع",
  payee: "المستفيد",
  method: "طريقة الدفع",
  referenceNo: "رقم المرجع",
  paidAt: "تاريخ الدفع",
  type: "النوع",
  notes: "ملاحظات",
  source: "المصدر",
  driverId: "المندوب",
  supplier: "المورد",
  balance: "الرصيد",
  responsible: "المسؤول",
  bankName: "البنك",
  iban: "IBAN",
  salesVat: "ضريبة المبيعات",
  purchaseVat: "ضريبة المشتريات",
  netVat: "صافي الضريبة",
  revenues: "الإيرادات",
  expenses: "المصروفات",
  payroll: "الرواتب",
  vehicleCosts: "تكلفة السيارات",
  netProfit: "صافي الربح",
  vehicleId: "السيارة",
  rentCost: "الإيجار",
  maintenanceCost: "الصيانة",
  cleaningCost: "النظافة",
  accidentCost: "الحوادث",
  damageCost: "التلفيات",
  otherCost: "أخرى",
  totalCost: "الإجمالي",
};

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value || 0);
}

function number(value: number) {
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

function Button({
  children,
  tone = "white",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "white" | "green" | "blue" | "orange" | "red" | "dark" }) {
  const tones = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    orange: "border-orange-500 bg-orange-500 text-white hover:bg-orange-600",
    red: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  };
  return (
    <button {...props} suppressHydrationWarning className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

function LinkButton({ href, children, tone = "white" }: { href: string; children: ReactNode; tone?: "white" | "dark" | "blue" }) {
  const tones = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
  };
  return (
    <Link href={href} suppressHydrationWarning className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm transition ${tones[tone]}`}>
      {children}
    </Link>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("APPROVED") || status === "ACTIVE" || status === "Approved"
    ? "bg-emerald-100 text-emerald-800"
    : status.includes("LOCKED") || status.includes("PAID") || status === "Locked" || status === "Paid"
      ? "bg-blue-100 text-blue-800"
      : status.includes("REJECTED") || status.includes("CANCELLED")
        ? "bg-rose-100 text-rose-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tone}`}>{statusLabels[status] || status || "-"}</span>;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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

function inputType(field: string) {
  if (field.endsWith("At") || field.endsWith("Date") || ["issuedAt", "dueDate", "paidAt"].includes(field)) return "date";
  if (field === "month") return "month";
  if (/amount|balance|vat|revenues|expenses|payroll|cost|profit/i.test(field)) return "number";
  return "text";
}

function initialValue(field: string, row?: FinanceRow | null) {
  const value = row?.raw[field];
  if (value !== undefined && value !== null) return String(value);
  if (field === "status") return "PENDING";
  if (field === "invoiceStatus") return "Draft";
  if (field === "month") return currentMonth();
  if (field.endsWith("At") || field.endsWith("Date")) return today();
  return "";
}

function fieldOptions(field: string, data: FinanceModulePageData) {
  if (field === "status") return statusOptions.filter((option) => option.value);
  if (field === "applicationProjectId") return data.refs.applicationProjects.map((item) => ({ value: item.id, label: item.label }));
  if (field === "driverId") return data.refs.drivers.map((item) => ({ value: item.id, label: item.label }));
  if (field === "vehicleId") return data.refs.vehicles.map((item) => ({ value: item.id, label: item.label }));
  return null;
}

function FinanceForm({
  data,
  row,
  onClose,
  onDone,
}: {
  data: FinanceModulePageData;
  row: FinanceRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(row);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.module.api) {
      onDone("هذه الميزة قيد التطوير");
      return;
    }
    setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(isEdit ? `${data.module.api}/${row?.id}` : data.module.api, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      onDone(result.error || "تعذر حفظ السجل.");
      return;
    }
    onDone(isEdit ? "تم تعديل السجل بنجاح." : "تمت إضافة السجل بنجاح.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 pt-8">
      <form onSubmit={submit} className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{isEdit ? "تعديل السجل" : "إضافة سجل"}</h2>
            <p className="text-xs font-bold text-slate-500">{data.module.title}</p>
          </div>
          <Button type="button" onClick={onClose}>إغلاق</Button>
        </div>
        {data.module.formFields.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.module.formFields.map((field) => {
              const options = fieldOptions(field, data);
              return (
                <label key={field} className="grid gap-1 text-sm font-black text-slate-700">
                  {fieldLabels[field] || field}
                  {options ? (
                    <select name={field} defaultValue={initialValue(field, row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500">
                      <option value="">بدون اختيار</option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input name={field} type={inputType(field)} step="0.01" defaultValue={initialValue(field, row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500" />
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-black text-slate-500">
            هذا التقرير للعرض فقط ولا يحتوي على نموذج إضافة مباشر.
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onClose}>إلغاء</Button>
          <Button type="submit" tone="green" disabled={saving || !data.module.formFields.length}>
            {saving ? "جار الحفظ..." : "حفظ"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DetailsModal({ row, data, onClose }: { row: FinanceRow; data: FinanceModulePageData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 pt-8">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{row.primary}</h2>
            <p className="text-xs font-bold text-slate-500">{data.module.title}</p>
          </div>
          <Button type="button" onClick={onClose}>إغلاق</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.module.columns.map((column) => (
            <div key={column.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">{column.label}</p>
              <p className="mt-1 text-base font-black text-slate-950">
                {column.key === "status" ? <StatusBadge status={String(row.cells[column.key] || row.status)} /> : column.money ? money(Number(row.cells[column.key] || 0)) : String(row.cells[column.key] ?? "-")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterBar({ data }: { data: FinanceModulePageData }) {
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    router.push(`${data.module.route}?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <label className="grid gap-1 text-xs font-black text-slate-600">
          من تاريخ
          <input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          إلى تاريخ
          <input name="toDate" type="date" defaultValue={data.filters.toDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          الشهر
          <input name="month" type="month" defaultValue={data.filters.month} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المشروع
          <select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل المشاريع</option>
            {data.refs.applicationProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المدينة
          <select name="cityId" defaultValue={data.filters.cityId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.refs.cities.map((city) => (
              <option key={city.id} value={city.id}>{city.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          الحالة
          <select name="status" defaultValue={data.filters.status} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            {statusOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          بحث
          <input name="q" defaultValue={data.filters.q} placeholder="بحث..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" tone="dark">تطبيق</Button>
        <LinkButton href={data.module.route}>عرض الكل</LinkButton>
      </div>
    </form>
  );
}

export function FinanceModulePageClient({ data }: ModuleProps) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [formRow, setFormRow] = useState<FinanceRow | null | undefined>(undefined);
  const [details, setDetails] = useState<FinanceRow | null>(null);
  const [sortKey, setSortKey] = useState(data.module.columns[0]?.key ?? "createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const selected = useMemo(() => data.rows.find((row) => row.id === selectedId) || null, [data.rows, selectedId]);
  const sortedRows = useMemo(() => {
    const rows = [...data.rows];
    rows.sort((a, b) => {
      const left = a.cells[sortKey] ?? a.raw[sortKey] ?? "";
      const right = b.cells[sortKey] ?? b.raw[sortKey] ?? "";
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      const result = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? leftNumber - rightNumber
        : String(left).localeCompare(String(right), "ar");
      return sortDirection === "asc" ? result : -result;
    });
    return rows;
  }, [data.rows, sortDirection, sortKey]);
  const totalPages = Math.max(Math.ceil(sortedRows.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const visibleRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setPage(1);
  }

  function showUnderConstruction() {
    setToast("هذه الميزة قيد التطوير");
  }

  function exportRows() {
    downloadCsv(
      `${data.module.key}-${new Date().toISOString().slice(0, 10)}.csv`,
      data.module.columns.map((column) => column.label),
      data.rows.map((row) => data.module.columns.map((column) => row.cells[column.key] ?? "")),
    );
  }

  async function copySummary() {
    const text = [
      data.module.title,
      `عدد السجلات: ${data.summary.total}`,
      `إجمالي القيمة: ${Math.round(data.summary.totalAmount)}`,
      `المعتمد: ${Math.round(data.summary.approvedAmount)}`,
      `المفتوح: ${Math.round(data.summary.openAmount)}`,
    ].join("\n");
    await navigator.clipboard?.writeText(text).catch(() => null);
    setToast("تم نسخ ملخص الصفحة.");
  }

  async function remove(row: FinanceRow | null) {
    if (!row) {
      setToast("اختر سجلًا أولًا.");
      return;
    }
    if (!data.module.api) {
      showUnderConstruction();
      return;
    }
    if (!confirm(`حذف / تعطيل السجل: ${row.primary}؟`)) return;
    const response = await fetch(`${data.module.api}/${row.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(result.error || "تعذر حذف السجل.");
      return;
    }
    setToast("تم تنفيذ الإجراء بنجاح.");
    setSelectedId("");
    router.refresh();
  }

  function formDone(message: string) {
    setToast(message);
    router.refresh();
  }

  if (data.databaseOffline) {
    return (
      <main dir="rtl" className="min-h-screen w-full max-w-none bg-slate-50 p-4 text-slate-950">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-rose-900">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-rose-700">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen w-full max-w-none space-y-4 bg-slate-50 p-4 text-slate-950">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {formRow !== undefined ? <FinanceForm data={data} row={formRow} onClose={() => setFormRow(undefined)} onDone={formDone} /> : null}
      {details ? <DetailsModal row={details} data={data} onClose={() => setDetails(null)} /> : null}

      <FinanceQuickNav current={data.module.route} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
            <h1 className="mt-1 text-3xl font-black">{data.module.title}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{data.module.description}</p>
            <p className="mt-2 text-xs font-bold text-slate-400">الرئيسية / الماليات / {data.module.title}</p>
          </div>
          <LinkButton href="/finance">رجوع للماليات</LinkButton>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap gap-2">
          <Button type="button" tone="green" onClick={() => (data.module.formFields.length ? setFormRow(null) : showUnderConstruction())}>+ إضافة</Button>
          <Button type="button" tone="blue" onClick={showUnderConstruction}>استيراد Excel / PDF</Button>
          <Button type="button" onClick={() => (selected ? setFormRow(selected) : setToast("اختر سجلًا للتعديل."))}>تعديل</Button>
          <Button type="button" tone="red" onClick={() => void remove(selected)}>حذف</Button>
          <Button type="button" tone="orange" onClick={exportRows}>تصدير CSV</Button>
          <Button type="button" onClick={() => void copySummary()}>نسخ الملخص</Button>
          <Button type="button" onClick={() => window.print()}>طباعة / PDF</Button>
          <Button type="button" tone="dark" onClick={() => router.refresh()}>تحديث البيانات</Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="عدد السجلات" value={number(data.summary.total)} />
        <SummaryCard title="إجمالي القيمة" value={money(data.summary.totalAmount)} tone="blue" />
        <SummaryCard title="المعتمد" value={money(data.summary.approvedAmount)} tone="emerald" />
        <SummaryCard title="المفتوح / غير المقفل" value={money(data.summary.openAmount)} tone="amber" />
      </section>

      <section className="grid gap-3 md:grid-cols-3 print:hidden">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-900">معتمد: {number(data.summary.approved)} سجل</div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-900">قيد المتابعة: {number(data.summary.pending)} سجل</div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-black text-blue-900">مدفوع/مقفل: {number(data.summary.paidOrLocked)} سجل</div>
      </section>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-black text-blue-900">
        {data.insight}
      </div>

      <FilterBar data={data} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-500">
          <span>يعرض {number(sortedRows.length ? (safePage - 1) * pageSize + 1 : 0)} - {number(Math.min(safePage * pageSize, sortedRows.length))} من {number(sortedRows.length)} / الصفحة {number(safePage)} من {number(totalPages)}</span>
          <div className="flex items-center gap-2">
            <span>عدد الصفوف</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="max-h-[68vh] overflow-auto rounded-2xl border border-slate-100">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="sticky right-0 top-0 z-20 whitespace-nowrap bg-slate-100 px-3 py-3 text-right">
                  <input type="checkbox" checked={Boolean(selectedId && data.rows.length === 1)} onChange={() => setSelectedId("")} />
                </th>
                {data.module.columns.map((column) => (
                  <th key={column.key} className="sticky top-0 z-10 whitespace-nowrap bg-slate-100 px-3 py-3 text-right font-black">
                    <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 font-black">
                      <span>{column.label}</span>
                      <span className="text-[10px] text-slate-400">{sortKey === column.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  </th>
                ))}
                <th className="sticky left-0 top-0 z-20 whitespace-nowrap bg-slate-100 px-3 py-3 text-right font-black">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="sticky right-0 z-10 bg-white px-3 py-3">
                      <input type="checkbox" checked={selectedId === row.id} onChange={(event) => setSelectedId(event.target.checked ? row.id : "")} />
                    </td>
                    {data.module.columns.map((column) => (
                      <td key={column.key} className="max-w-[260px] truncate whitespace-nowrap px-3 py-3 font-bold" title={String(row.cells[column.key] ?? "-")}>
                        {column.key === "status" || column.key === "invoiceStatus" ? (
                          <StatusBadge status={String(row.cells[column.key] || row.status)} />
                        ) : column.money ? (
                          money(Number(row.cells[column.key] || 0))
                        ) : (
                          String(row.cells[column.key] ?? "-")
                        )}
                      </td>
                    ))}
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-3 shadow-[-10px_0_20px_rgba(15,23,42,0.06)]">
                      <div className="flex flex-nowrap gap-2">
                        <Button type="button" onClick={() => setDetails(row)}>فتح</Button>
                        <Button type="button" onClick={() => setFormRow(row)}>تعديل</Button>
                        <Button type="button" tone="red" onClick={() => void remove(row)}>حذف</Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={data.module.columns.length + 2} className="px-3 py-10 text-center">
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8">
                      <p className="text-xl font-black text-slate-800">لا توجد بيانات حسب الفلاتر الحالية</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">غيّر التاريخ أو الحالة أو المشروع، أو أضف سجلًا جديدًا.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-black text-slate-500">يعرض {number(visibleRows.length)} من {number(sortedRows.length)} سجل</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={safePage <= 1} onClick={() => setPage(1)}>الأولى</Button>
            <Button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>السابق</Button>
            <Button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>التالي</Button>
            <Button type="button" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>الأخيرة</Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function OverviewFilter({ data }: { data: FinanceOverviewData }) {
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    router.push(`/finance?${params.toString()}`);
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-xs font-black text-slate-600">من تاريخ<input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" /></label>
        <label className="grid gap-1 text-xs font-black text-slate-600">إلى تاريخ<input name="toDate" type="date" defaultValue={data.filters.toDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" /></label>
        <label className="grid gap-1 text-xs font-black text-slate-600">الشهر<input name="month" type="month" defaultValue={data.filters.month} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" /></label>
        <div className="flex items-end gap-2">
          <Button type="submit" tone="dark" className="w-full">تطبيق</Button>
          <LinkButton href="/finance">عرض الكل</LinkButton>
        </div>
      </div>
    </form>
  );
}

export function FinanceOverviewClient({ data }: OverviewProps) {
  const [toast, setToast] = useState("");
  if (data.databaseOffline) {
    return (
      <main dir="rtl" className="min-h-screen w-full max-w-none bg-slate-50 p-4 text-slate-950">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-rose-900">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-rose-700">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen w-full max-w-none space-y-4 bg-slate-50 p-4 text-slate-950">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      <FinanceQuickNav current="/finance" />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
            <h1 className="mt-1 text-3xl font-black">مركز الماليات</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">الإيرادات والمصروفات والرواتب والخصومات من البيانات المعتمدة والمحفوظة في PostgreSQL.</p>
            <p className="mt-2 text-xs font-bold text-slate-400">الرئيسية / الماليات / مركز الماليات</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" tone="green" onClick={() => setToast("افتح الصفحة المالية المطلوبة من الكروت بالأسفل لإضافة سجل.")}>+ إضافة</Button>
            <Button type="button" tone="blue" onClick={() => setToast("الاستيراد المالي يتم من صفحات المشاريع أو صفحة الاستيراد حسب نوع الملف.")}>استيراد Excel / PDF</Button>
            <Button type="button" tone="orange" onClick={() => window.print()}>طباعة / PDF</Button>
          </div>
        </div>
      </section>

      <OverviewFilter data={data} />

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="إجمالي الإيرادات" value={money(data.summary.totalRevenue)} tone="emerald" />
        <SummaryCard title="مستحق الشركة من كيتا" value={money(data.summary.keetaRevenue)} tone="emerald" />
        <SummaryCard title="تكلفة الرواتب المعتمدة" value={money(data.summary.payrollCost)} tone="blue" />
        <SummaryCard title="المصروفات" value={money(data.summary.registeredExpenses)} tone="red" />
        <SummaryCard title="تكلفة السيارات" value={money(data.summary.vehicleCosts)} tone="amber" />
        <SummaryCard title="السلف" value={money(data.summary.advances)} tone="amber" />
        <SummaryCard title="الخصومات والمخالفات" value={money(data.summary.deductions + data.summary.violations)} tone="red" />
        <SummaryCard title="الربح التقديري" value={money(data.summary.estimatedProfit)} tone={data.summary.estimatedProfit >= 0 ? "emerald" : "red"} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {data.modules.map((module) => (
          <Link key={module.href} href={module.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-black text-slate-500">{module.description}</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{module.title}</h2>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{number(module.total)} سجل</span>
              <strong className={`text-lg font-black ${module.tone === "red" ? "text-rose-700" : module.tone === "emerald" ? "text-emerald-700" : module.tone === "amber" ? "text-amber-700" : "text-blue-700"}`}>{money(module.amount)}</strong>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-lg font-black text-amber-950">التنبيهات المالية</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.alerts.length ? data.alerts.map((alert) => <span key={alert} className="rounded-full bg-white px-3 py-2 text-xs font-black text-amber-900 shadow-sm">{alert}</span>) : <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">لا توجد تنبيهات مالية ضمن الفلاتر الحالية</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">أعلى إيرادات معتمدة</h2>
          <div className="mt-3 space-y-2">
            {data.topRows.length ? data.topRows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-black">
                <span>{row.label}<small className="block text-xs text-slate-500">{row.sub}</small></span>
                <span className="text-emerald-700">{money(row.value)}</span>
              </div>
            )) : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-black text-slate-500">لا توجد بيانات كافية.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
