"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ResourceConfig } from "@/lib/resources";

type Row = Record<string, unknown> & { id?: string };
type Mode = "create" | "edit" | "view" | null;

type ApiListResponse = {
  data?: Row[];
  meta?: { count?: number; total?: number; resource?: string };
  error?: string;
};

type ReferenceOption = { label: string; value: string };
type ReferenceData = Record<string, ReferenceOption[]>;

const fieldLabels: Record<string, string> = {
  id: "المعرف",
  name: "الاسم",
  nameAr: "الاسم العربي",
  nameEn: "الاسم الإنجليزي",
  code: "الكود",
  description: "الوصف",
  email: "الإيميل",
  role: "الصلاحية",
  isActive: "نشط",
  status: "الحالة",
  phone: "الجوال",
  mobile: "الجوال",
  internalCode: "كود المندوب",
  driverCode: "كود المندوب الداخلي",
  actualName: "الاسم الفعلي",
  nationalId: "رقم الهوية / الإقامة",
  nationality: "الجنسية",
  cityId: "المدينة",
  projectId: "المشروع",
  applicationId: "التطبيق",
  applicationProjectId: "مشروع التطبيق",
  supervisorId: "المشرف",
  driverId: "المندوب",
  vehicleId: "السيارة",
  accountId: "حساب التطبيق",
  contractType: "نوع العقد",
  sponsorshipType: "نوع العلاقة",
  accommodationType: "نوع السكن",
  housingStatus: "حالة السكن",
  joinDate: "تاريخ بداية العمل",
  vehicleCode: "كود السيارة",
  plateAr: "اللوحة عربي",
  plateArabic: "اللوحة عربي",
  plateEn: "اللوحة إنجليزي",
  plateEnglish: "اللوحة إنجليزي",
  brand: "الماركة",
  model: "الموديل",
  year: "سنة الصنع",
  rentalCompany: "شركة التأجير",
  monthlyRent: "الإيجار الشهري",
  currentDriverId: "المندوب الحالي",
  appName: "التطبيق",
  username: "اسم المستخدم",
  appUserId: "App User ID",
  appUsername: "App Username",
  isEmpty: "حساب فارغ",
  linkedAt: "تاريخ الربط",
  reportDate: "تاريخ التقرير",
  month: "الشهر",
  orders: "الطلبات",
  workingHours: "ساعات العمل",
  onTimeRate: "On-Time %",
  cancellationRate: "Cancellation %",
  rejectionRate: "Rejection %",
  amount: "المبلغ",
  remainingAmount: "المتبقي",
  reason: "السبب",
  deductionMonth: "شهر الخصم",
  type: "النوع",
  notes: "ملاحظات",
  occurredAt: "تاريخ المخالفة",
  basicSalary: "الراتب الأساسي",
  bonus: "الحوافز",
  deductions: "الخصومات",
  netSalary: "صافي راتب المندوب",
  title: "العنوان",
  body: "النص",
  priority: "الأولوية",
  severity: "الشدة",
  dueDate: "موعد المتابعة",
  entityType: "نوع الكيان",
  entityId: "رقم السجل",
  candidateName: "اسم المرشح",
  scheduledAt: "موعد المقابلة",
  convertedDriverId: "المندوب الناتج",
  documentType: "نوع المستند",
  documentNumber: "رقم المستند",
  issueDate: "تاريخ الإصدار",
  expiryDate: "تاريخ الانتهاء",
  verificationStatus: "حالة التحقق",
  fileUrl: "رابط الملف",
  sponsor: "الكفيل / الشركة",
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  housingType: "نوع السكن",
  location: "الموقع",
  monthlyCost: "التكلفة الشهرية",
  issuedAt: "تاريخ الإنذار",
  followUpAt: "موعد المتابعة",
  personType: "نوع الشخص",
  workDate: "تاريخ العمل",
  checkIn: "حضور",
  checkOut: "انصراف",
  startTime: "وقت البداية",
  endTime: "وقت النهاية",
  fileName: "اسم الملف",
  importType: "نوع الاستيراد",
  rowsCount: "عدد الصفوف",
  rowsFound: "صفوف الملف",
  rowsImported: "صفوف مستوردة",
  rowsSkipped: "صفوف متجاهلة",
  errors: "الأخطاء",
  uploadedBy: "رفع بواسطة",
  fromDriverId: "من مندوب",
  toDriverId: "إلى مندوب",
  movementType: "نوع الحركة",
  movementDate: "تاريخ الحركة",
  handoverDate: "تاريخ التسليم",
  returnDate: "تاريخ الاستلام",
  monthlyTarget: "التارجت الشهري",
  requiredValidRiders: "المناديب المطلوبين",
  createdBy: "أنشئ بواسطة",
  user: "المستخدم",
  action: "الإجراء",
  key: "المفتاح",
  value: "القيمة",
  updatedBy: "آخر تعديل بواسطة",
  cleanDate: "تاريخ النظافة",
  cost: "التكلفة",
  vendor: "المورد / الورشة",
  date: "التاريخ",
  authNumber: "رقم التفويض",
  contact: "مسؤول التواصل",
  rentCost: "الإيجار",
  maintenanceCost: "الصيانة",
  cleaningCost: "النظافة",
  accidentCost: "الحوادث",
  damageCost: "التلفيات",
  otherCost: "أخرى",
  totalCost: "الإجمالي",
  liabilityPercent: "نسبة المسؤولية",
  estimatedCost: "التكلفة المتوقعة",
  finalCost: "التكلفة النهائية",
  number: "رقم الفاتورة",
  client: "العميل",
  vatAmount: "ضريبة القيمة المضافة",
  paidAmount: "المدفوع",
  payee: "المستفيد",
  method: "طريقة الدفع",
  referenceNo: "رقم المرجع",
  source: "المصدر",
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
  vehicleCosts: "تكاليف السيارات",
  netProfit: "صافي الربح",
  result: "النتيجة",
  reviewedBy: "المراجع",
  reportType: "نوع التقرير",
  provider: "المزود",
  lastSyncAt: "آخر مزامنة",
  settings: "الإعدادات",
  issueType: "نوع المشكلة",
  createdAt: "تاريخ الإنشاء",
  updatedAt: "آخر تحديث",
};

const statusOptions = [
  { label: "نشط", value: "ACTIVE" },
  { label: "غير نشط", value: "INACTIVE" },
  { label: "معلق", value: "PENDING" },
  { label: "معتمد", value: "APPROVED" },
  { label: "مرفوض", value: "REJECTED" },
  { label: "مقفل", value: "LOCKED" },
  { label: "مسودة", value: "DRAFT" },
  { label: "تحت المراجعة", value: "UNDER_REVIEW" },
  { label: "مدفوع", value: "PAID" },
  { label: "متاح", value: "AVAILABLE" },
  { label: "مع مندوب", value: "ASSIGNED" },
  { label: "صيانة", value: "MAINTENANCE" },
  { label: "حادث", value: "ACCIDENT" },
  { label: "موقوف", value: "SUSPENDED" },
];

const roleOptions = [
  { label: "Admin", value: "ADMIN" },
  { label: "Operation Manager", value: "OPERATION_MANAGER" },
  { label: "Supervisor", value: "SUPERVISOR" },
  { label: "Accountant", value: "ACCOUNTANT" },
  { label: "HR", value: "HR" },
  { label: "Viewer", value: "VIEWER" },
];

const severityOptions = [
  { label: "حرج", value: "CRITICAL" },
  { label: "تحذير", value: "WARNING" },
  { label: "معلومة", value: "INFO" },
];

const booleanOptions = [
  { label: "نعم", value: "true" },
  { label: "لا", value: "false" },
];

const readOnlyFields = new Set(["id", "createdAt", "updatedAt"]);
const jsonFields = new Set(["value", "before", "after", "oldValue", "newValue", "settings", "mapping", "columns", "filters"]);

export function ResourceWorkspace({ resource, compact = false }: { resource: ResourceConfig; compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [references, setReferences] = useState<ReferenceData>({});
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [page, setPage] = useState(1);

  const formFields = useMemo(() => {
    const keys = new Set([...resource.searchFields, ...resource.columns.map((column) => column.key)]);
    return [...keys].filter((key) => !readOnlyFields.has(key));
  }, [resource]);

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadRows("");
  }, [resource.api]);

  async function loadReferences() {
    try {
      const response = await fetch("/api/reference-data", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: ReferenceData };
      setReferences(payload.data ?? {});
    } catch {
      setReferences({});
    }
  }

  async function loadRows(search: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("take", "500");
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`${resource.api}?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as ApiListResponse;
      if (!response.ok) throw new Error(readableError(payload.error, response.status));
      setRows(payload.data ?? []);
      setTotal(payload.meta?.total ?? payload.meta?.count ?? payload.data?.length ?? 0);
      setPage(1);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "تعذر تحميل البيانات. تأكد من اتصال قاعدة البيانات.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveQuery(query);
    void loadRows(query);
  }

  function clearSearch() {
    setQuery("");
    setActiveQuery("");
    void loadRows("");
  }

  function openCreate() {
    setSelected(null);
    setMode("create");
    setError(null);
    setNotice(null);
  }

  function openEdit(row: Row) {
    setSelected(row);
    setMode("edit");
    setError(null);
    setNotice(null);
  }

  function openView(row: Row) {
    setSelected(row);
    setMode("view");
    setError(null);
    setNotice(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const field of formFields) {
      const value = formData.get(field);
      if (value === null || value === "") continue;
      body[field] = normalizeFormValue(field, String(value));
    }

    try {
      const isEdit = mode === "edit" && selected?.id;
      const response = await fetch(isEdit ? `${resource.api}/${selected.id}` : resource.api, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(readableError(payload.error, response.status));
      setMode(null);
      setNotice(isEdit ? "تم تحديث السجل بنجاح." : "تم إنشاء السجل بنجاح.");
      await loadRows(activeQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ السجل.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: Row) {
    if (!row.id) return;
    const confirmed = window.confirm("هل تريد تنفيذ الحذف أو التعطيل لهذا السجل؟");
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${resource.api}/${row.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(readableError(payload.error, response.status));
      setNotice(resource.key === "drivers" || resource.key === "vehicles" ? "تم تعطيل السجل بدل الحذف لحماية البيانات المرتبطة." : "تم حذف السجل بنجاح.");
      await loadRows(activeQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف السجل.");
    } finally {
      setSaving(false);
    }
  }

  const pageSize = compact ? 8 : 15;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const empty = !loading && !error && rows.length === 0;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black text-slate-500">إجمالي السجلات</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <strong className="text-2xl font-black text-slate-950">{total}</strong>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                المعروض: {visibleRows.length} من {rows.length}
              </span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-3xl">
            <label htmlFor={`${resource.key}-search`} className="sr-only">
              بحث في {resource.title}
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                id={`${resource.key}-search`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالاسم، الكود، الجوال، المدينة، الحالة..."
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800" disabled={loading}>
                بحث
              </button>
              <button type="button" onClick={clearSearch} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50" disabled={loading}>
                عرض الكل
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadRows(activeQuery)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50" disabled={loading}>
              تحديث
            </button>
            <button type="button" onClick={() => downloadCsv(resource, rows, references)} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100" disabled={!rows.length}>
              تصدير CSV
            </button>
            <button type="button" onClick={openCreate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700">
              إضافة سجل
            </button>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="table-scroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {resource.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3">
                  {column.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center font-bold text-slate-500" colSpan={resource.columns.length + 1}>
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : null}

            {empty ? (
              <tr>
                <td className="px-4 py-10 text-center" colSpan={resource.columns.length + 1}>
                  <h3 className="text-base font-black text-slate-950">لا توجد بيانات محفوظة حاليًا</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">يمكن إضافة سجل جديد أو استيراد بيانات بعد مراجعة الـ Preview واعتماد الحفظ.</p>
                </td>
              </tr>
            ) : null}

            {!loading
              ? visibleRows.map((row) => (
                  <tr key={String(row.id ?? JSON.stringify(row))} className="hover:bg-slate-50">
                    {resource.columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {["status", "severity", "priority", "role"].includes(column.key) ? (
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(row[column.key])}`}>
                            {statusLabel(row[column.key])}
                          </span>
                        ) : (
                          <span>{referenceLabel(column.key, row[column.key], references) || formatCell(row[column.key])}</span>
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openView(row)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-50">
                          عرض
                        </button>
                        <button type="button" onClick={() => openEdit(row)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 transition hover:bg-amber-100">
                          تعديل
                        </button>
                        <button type="button" onClick={() => void handleDelete(row)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100" disabled={saving}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
          <span>
            صفحة {currentPage} من {pageCount}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              السابق
            </button>
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              التالي
            </button>
          </div>
        </div>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">{mode === "create" ? `إضافة ${resource.title}` : mode === "edit" ? `تعديل ${resource.title}` : `تفاصيل ${resource.title}`}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{resource.description}</p>
              </div>
              <button type="button" onClick={() => setMode(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-50">
                إغلاق
              </button>
            </div>

            {mode === "view" ? (
              <div className="max-h-[74vh] overflow-auto p-5">
                <dl className="grid gap-3 md:grid-cols-2">
                  {Object.entries(selected ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <dt className="text-xs font-black text-slate-500">{fieldLabels[key] ?? key}</dt>
                      <dd className="mt-1 break-words text-sm font-bold text-slate-900">{referenceLabel(key, value, references) || formatCell(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <form onSubmit={handleSave} className="max-h-[76vh] overflow-auto p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {formFields.map((field) => {
                    const fieldId = `${resource.key}-${field}`;
                    const options = optionsForField(field, resource.key, references);
                    const value = stringifyValue(selected?.[field]);
                    const required = requiredFields(resource.key).has(field);
                    return (
                      <label key={field} htmlFor={fieldId} className="grid gap-2 text-sm font-bold text-slate-700">
                        <span>
                          {fieldLabels[field] ?? field}
                          {required ? <span className="text-red-600"> *</span> : null}
                        </span>
                        {jsonFields.has(field) || field === "notes" || field === "description" || field === "body" ? (
                          <textarea id={fieldId} name={field} defaultValue={value} rows={jsonFields.has(field) ? 5 : 3} required={required} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                        ) : options ? (
                          <select id={fieldId} name={field} defaultValue={value || (required ? options[0]?.value : "")} required={required} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                            {!required ? <option value="">بدون اختيار</option> : null}
                            {options.map((option, optionIndex) => (
                              <option key={`${option.value}:${optionIndex}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input id={fieldId} name={field} type={inputType(field)} defaultValue={value} required={required} step={inputType(field) === "number" ? "0.01" : undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4">
                  <button type="button" onClick={() => setMode(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50" disabled={saving}>
                    إلغاء
                  </button>
                  <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving}>
                    {saving ? "جاري الحفظ..." : "حفظ"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function readableError(error: string | undefined, status: number) {
  if (error === "Database offline") return "قاعدة البيانات غير متصلة. شغل PostgreSQL ثم حدث الصفحة.";
  if (status === 401) return "انتهت الجلسة. سجل الدخول مرة أخرى.";
  if (status === 403) return "ليس لديك صلاحية لتنفيذ هذا الإجراء.";
  if (status === 404) return "المسار أو السجل غير موجود.";
  return error || "حدث خطأ غير متوقع.";
}

function requiredFields(resourceKey: string) {
  const map: Record<string, string[]> = {
    users: ["name", "email", "role"],
    cities: ["nameAr"],
    projects: ["name"],
    supervisors: ["name"],
    drivers: ["internalCode", "name"],
    vehicles: ["plateEn"],
    applications: ["code", "name"],
    tasks: ["title"],
    notifications: ["title"],
  };
  return new Set(map[resourceKey] ?? []);
}

function referenceKey(field: string) {
  if (field === "cityId") return "cities";
  if (field === "projectId") return "projects";
  if (field === "supervisorId") return "supervisors";
  if (field === "driverId" || field === "fromDriverId" || field === "toDriverId" || field === "convertedDriverId" || field === "currentDriverId") return "drivers";
  if (field === "vehicleId") return "vehicles";
  if (field === "applicationId") return "applications";
  if (field === "applicationProjectId") return "applicationProjects";
  return null;
}

function optionsForField(field: string, resourceKey: string, references: ReferenceData) {
  const ref = referenceKey(field);
  if (ref) return references[ref] ?? [];
  if (field === "role") return roleOptions;
  if (field === "status") return statusOptionsForResource(resourceKey);
  if (field === "severity") return severityOptions;
  if (field === "isActive" || field === "isEmpty" || field.startsWith("showIn") || field.startsWith("affects")) return booleanOptions;
  if (field === "personType") return [{ label: "مندوب", value: "driver" }, { label: "مشرف", value: "supervisor" }, { label: "مستخدم", value: "user" }];
  if (field === "movementType") return [
    { label: "تسليم", value: "handover" },
    { label: "استلام", value: "return" },
    { label: "نقل من مندوب لمندوب", value: "transfer" },
    { label: "دخول صيانة", value: "maintenance_in" },
    { label: "خروج من صيانة", value: "maintenance_out" },
  ];
  return null;
}

function statusOptionsForResource(resourceKey: string) {
  if (resourceKey === "vehicles") {
    return [
      { label: "متاحة", value: "AVAILABLE" },
      { label: "مع مندوب", value: "ASSIGNED" },
      { label: "صيانة", value: "MAINTENANCE" },
      { label: "حادث", value: "ACCIDENT" },
      { label: "غير نشطة", value: "INACTIVE" },
    ];
  }
  if (resourceKey === "drivers") {
    return [
      { label: "نشط", value: "ACTIVE" },
      { label: "غير نشط", value: "INACTIVE" },
      { label: "موقوف", value: "SUSPENDED" },
    ];
  }
  if (resourceKey === "payroll") {
    return [
      { label: "مسودة", value: "DRAFT" },
      { label: "تحت المراجعة", value: "UNDER_REVIEW" },
      { label: "معتمد", value: "APPROVED" },
      { label: "مدفوع", value: "PAID" },
      { label: "مقفل", value: "LOCKED" },
    ];
  }
  return statusOptions;
}

function inputType(field: string) {
  if (field.endsWith("At") || field.endsWith("Date") || ["reportDate", "dueDate", "occurredAt", "lockedAt", "workDate", "paidAt", "issuedAt"].includes(field)) return "date";
  if (/amount|cost|rent|salary|bonus|deduction|balance|hours|rate|percent|orders|rows|target|riders|days|payroll|revenues|expenses|profit|year/i.test(field)) return "number";
  if (field === "email") return "email";
  if (field === "phone" || field === "mobile") return "tel";
  return "text";
}

function normalizeFormValue(field: string, value: string) {
  if (value === "true" || value === "false") return value === "true";
  if (inputType(field) === "number") return Number(value);
  if (jsonFields.has(field)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function stringifyValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function formatCell(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  return statusLabel(text);
}

function statusLabel(value: unknown) {
  const text = String(value ?? "");
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    PENDING: "معلق",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    LOCKED: "مقفل",
    DRAFT: "مسودة",
    UNDER_REVIEW: "تحت المراجعة",
    PAID: "مدفوع",
    AVAILABLE: "متاحة",
    ASSIGNED: "مع مندوب",
    MAINTENANCE: "صيانة",
    ACCIDENT: "حادث",
    SUSPENDED: "موقوف",
    CRITICAL: "حرج",
    WARNING: "تحذير",
    INFO: "معلومة",
    HIGH: "عالية",
    MEDIUM: "متوسطة",
    LOW: "منخفضة",
  };
  return labels[text] ?? text;
}

function statusClass(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  if (["ACTIVE", "APPROVED", "AVAILABLE", "PAID", "INFO", "LOW"].includes(text)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["PENDING", "UNDER_REVIEW", "WARNING", "MEDIUM", "ASSIGNED", "MAINTENANCE", "DRAFT"].includes(text)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["REJECTED", "LOCKED", "CRITICAL", "HIGH", "INACTIVE", "SUSPENDED", "ACCIDENT"].includes(text)) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function referenceLabel(field: string, value: unknown, references: ReferenceData) {
  const key = referenceKey(field);
  if (!key || value == null || value === "") return "";
  return references[key]?.find((option) => option.value === String(value))?.label ?? "";
}

function downloadCsv(resource: ResourceConfig, rows: Row[], references: ReferenceData) {
  const headers = resource.columns.map((column) => column.label);
  const body = rows.map((row) =>
    resource.columns
      .map((column) => {
        const value = referenceLabel(column.key, row[column.key], references) || formatCell(row[column.key]);
        return `"${String(value).replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  const csv = `\uFEFF${headers.join(",")}\n${body.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${resource.key}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
