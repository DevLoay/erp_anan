"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ResourceConfig } from "@/lib/resources";

type Row = Record<string, unknown> & { id?: string };

type FieldType = "text" | "number" | "date" | "select" | "textarea" | "checkbox" | "json";

type FormField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { label: string; value: string }[];
};

type ReferenceOption = { label: string; value: string };
type ReferenceData = Record<string, ReferenceOption[]>;

type ApiListResponse = {
  data?: Row[];
  meta?: { count?: number; total?: number; resource?: string };
  error?: string;
};

type DetailCard = {
  label: string;
  value: string | number;
  tone?: "emerald" | "amber" | "red" | "blue" | "slate";
};

type DetailRow = {
  label: string;
  value: string | number;
  sub?: string;
};

type DetailTab = {
  key: string;
  title: string;
  cards: DetailCard[];
  rows?: DetailRow[];
};

type DetailPayload = {
  title: string;
  subtitle?: string;
  tabs: DetailTab[];
};

type WorkspaceMode = "create" | "edit" | "view" | null;

const recordStatusOptions = [
  { label: "نشط", value: "ACTIVE" },
  { label: "غير نشط", value: "INACTIVE" },
  { label: "قيد المراجعة", value: "PENDING" },
  { label: "معتمد", value: "APPROVED" },
  { label: "مرفوض", value: "REJECTED" },
  { label: "مقفل", value: "LOCKED" },
];

const driverStatusOptions = [
  { label: "نشط", value: "ACTIVE" },
  { label: "غير نشط", value: "INACTIVE" },
  { label: "موقوف", value: "SUSPENDED" },
];

const vehicleStatusOptions = [
  { label: "متاحة", value: "AVAILABLE" },
  { label: "مسلمة لمندوب", value: "ASSIGNED" },
  { label: "صيانة", value: "MAINTENANCE" },
  { label: "حادث", value: "ACCIDENT" },
  { label: "غير نشطة", value: "INACTIVE" },
];

const payrollStatusOptions = [
  { label: "مسودة", value: "DRAFT" },
  { label: "تحت المراجعة", value: "UNDER_REVIEW" },
  { label: "معتمد", value: "APPROVED" },
  { label: "مدفوع", value: "PAID" },
  { label: "مقفل", value: "LOCKED" },
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

const fieldLabels: Record<string, string> = {
  name: "الاسم",
  nameAr: "الاسم العربي",
  nameEn: "الاسم الإنجليزي",
  email: "البريد الإلكتروني",
  role: "الدور",
  isActive: "نشط",
  status: "الحالة",
  phone: "الجوال",
  internalCode: "كود المندوب",
  nationalId: "رقم الهوية",
  cityId: "المدينة",
  projectId: "المشروع",
  supervisorId: "المشرف",
  vehicleId: "السيارة",
  accountId: "حساب التطبيق",
  contractType: "نوع العقد",
  housingStatus: "حالة السكن",
  plateAr: "اللوحة عربي",
  plateEn: "اللوحة إنجليزي",
  model: "الموديل",
  rentalCompany: "شركة التأجير",
  monthlyRent: "الإيجار الشهري",
  currentDriverId: "المندوب الحالي",
  appName: "التطبيق",
  username: "اسم الحساب",
  driverId: "المندوب",
  isEmpty: "حساب فارغ",
  reportDate: "تاريخ التقرير",
  month: "الشهر",
  orders: "الطلبات",
  workingHours: "ساعات العمل",
  onTimeRate: "نسبة الالتزام",
  cancellationRate: "نسبة الإلغاء",
  rejectionRate: "نسبة الرفض",
  amount: "المبلغ",
  remainingAmount: "المتبقي",
  reason: "السبب",
  deductionMonth: "شهر الخصم",
  type: "النوع",
  notes: "ملاحظات",
  occurredAt: "تاريخ الواقعة",
  basicSalary: "الراتب الأساسي",
  bonus: "المكافأة",
  deductions: "الخصومات",
  netSalary: "الصافي",
  title: "العنوان",
  body: "النص",
  description: "الوصف",
  priority: "الأولوية",
  severity: "الخطورة",
  dueDate: "تاريخ الاستحقاق",
  entityType: "نوع الكيان",
  entityId: "معرف الكيان",
  candidateName: "اسم المرشح",
  scheduledAt: "موعد المقابلة",
  convertedDriverId: "المندوب المحول",
  issueDate: "تاريخ الإصدار",
  expiryDate: "تاريخ الانتهاء",
  fileUrl: "رابط الملف",
  sponsor: "الكفيل / الشركة",
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  housingType: "نوع السكن",
  location: "الموقع",
  monthlyCost: "التكلفة الشهرية",
  issuedAt: "تاريخ الإنذار",
  followUpAt: "موعد المتابعة",
  workDate: "تاريخ العمل",
  checkIn: "حضور",
  checkOut: "انصراف",
  startTime: "وقت البداية",
  endTime: "وقت النهاية",
  fileName: "اسم الملف",
  importType: "نوع الاستيراد",
  rowsCount: "عدد الصفوف",
  uploadedBy: "رفع بواسطة",
  fromDriverId: "من مندوب",
  toDriverId: "إلى مندوب",
  movementType: "نوع الحركة",
  movementDate: "تاريخ الحركة",
  monthlyTarget: "الهدف الشهري",
  requiredValidRiders: "المناديب المؤهلون المطلوبون",
  rowsFound: "صفوف الملف",
  rowsImported: "صفوف مستوردة",
  rowsSkipped: "صفوف متخطاة",
  errors: "الأخطاء",
  createdBy: "أنشئ بواسطة",
  user: "المستخدم",
  action: "الإجراء",
  key: "المفتاح",
  value: "القيمة",
  updatedBy: "آخر تعديل بواسطة",
  handoverDate: "تاريخ التسليم",
  returnDate: "تاريخ الاستلام",
  cleanDate: "تاريخ النظافة",
  cost: "التكلفة",
  vendor: "المورد / الورشة",
  date: "التاريخ",
  authNumber: "رقم التفويض",
  contact: "المسؤول",
  rentCost: "الإيجار",
  maintenanceCost: "الصيانة",
  cleaningCost: "النظافة",
  accidentCost: "الحوادث",
  damageCost: "التلفيات",
  otherCost: "أخرى",
  totalCost: "الإجمالي",
  liabilityPercent: "نسبة المسؤولية",
  estimatedCost: "التكلفة التقديرية",
  finalCost: "التكلفة النهائية",
  number: "رقم الفاتورة",
  client: "العميل",
  vatAmount: "ضريبة القيمة المضافة",
  issuedAtInvoice: "تاريخ الإصدار",
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
  vehicleCosts: "تكلفة السيارات",
  netProfit: "صافي الربح",
  result: "النتيجة",
  reviewedBy: "راجع بواسطة",
  reportType: "نوع التقرير",
  columns: "الأعمدة",
  filters: "الفلاتر",
  mapping: "خريطة الأعمدة",
  provider: "المزود",
  lastSyncAt: "آخر مزامنة",
  settings: "الإعدادات",
  issueType: "نوع المشكلة",
};

const resourceFields: Record<string, FormField[]> = {
  users: fields(["name", "email", "role", "cityId", "supervisorId", "isActive"], ["name", "email"]),
  cities: fields(["nameAr", "nameEn", "status"], ["nameAr"]),
  projects: fields(["name", "appName", "cityId", "status"], ["name"]),
  supervisors: fields(["name", "phone", "email", "cityId", "status"], ["name"]),
  drivers: fields(
    [
      "internalCode",
      "name",
      "phone",
      "nationalId",
      "cityId",
      "projectId",
      "supervisorId",
      "vehicleId",
      "accountId",
      "status",
      "contractType",
      "housingStatus",
    ],
    ["internalCode", "name"],
  ),
  vehicles: fields(["plateAr", "plateEn", "model", "rentalCompany", "monthlyRent", "status", "currentDriverId", "cityId"], ["plateEn"]),
  applications: fields(["appName", "username", "projectId", "cityId", "driverId", "isEmpty", "status"], ["appName", "username"]),
  "daily-reports": fields(
    ["reportDate", "month", "driverId", "cityId", "projectId", "appName", "orders", "workingHours", "onTimeRate", "cancellationRate", "rejectionRate"],
    ["reportDate", "month"],
  ),
  advances: fields(["driverId", "amount", "remainingAmount", "reason", "deductionMonth", "status"], ["driverId"]),
  deductions: fields(["driverId", "type", "amount", "month", "status", "notes"], ["driverId", "type"]),
  violations: fields(["driverId", "type", "amount", "status", "occurredAt", "notes"], ["driverId", "type"]),
  payroll: fields(["driverId", "projectId", "month", "basicSalary", "bonus", "deductions", "netSalary", "status", "lockedAt"], ["driverId", "month"]),
  tasks: fields(["title", "description", "cityId", "supervisorId", "driverId", "priority", "status", "dueDate"], ["title"]),
  notifications: fields(["title", "body", "severity", "status", "driverId", "entityType", "entityId"], ["title"]),
  interviews: fields(["candidateName", "phone", "cityId", "projectId", "status", "scheduledAt", "convertedDriverId", "notes"], ["candidateName"]),
  "driver-documents": fields(["driverId", "type", "issueDate", "expiryDate", "status", "fileUrl", "notes"], ["driverId", "type"]),
  "driver-contracts": fields(["driverId", "contractType", "sponsor", "startDate", "endDate", "status", "notes"], ["driverId", "contractType"]),
  "driver-housing": fields(["driverId", "housingType", "location", "monthlyCost", "status", "startDate", "endDate", "notes"], ["driverId", "housingType"]),
  "driver-warnings": fields(["driverId", "type", "severity", "status", "issuedAt", "followUpAt", "notes"], ["driverId", "type"]),
  attendance: fields(["driverId", "workDate", "checkIn", "checkOut", "workingHours", "status", "notes"], ["driverId", "workDate"]),
  shifts: fields(["driverId", "name", "startTime", "endTime", "cityId", "status", "notes"], ["name"]),
  "uploaded-reports": fields(["fileName", "importType", "appName", "cityId", "month", "status", "rowsCount", "uploadedBy"], ["fileName", "importType"]),
  "app-account-movements": fields(["accountId", "appName", "fromDriverId", "toDriverId", "movementType", "movementDate", "status", "notes"], ["movementType"]),
  "city-targets": fields(["cityId", "projectId", "appName", "month", "monthlyTarget", "requiredValidRiders", "status", "notes"], ["cityId", "month"]),
  "import-batches": fields(["fileName", "importType", "appName", "month", "status", "rowsFound", "rowsImported", "rowsSkipped", "errors", "createdBy"], ["fileName", "importType"]),
  "audit-logs": fields(["user", "action", "entityType", "entityId", "oldValue", "newValue"], ["action", "entityType"]),
  "system-settings": fields(["key", "value", "updatedBy"], ["key", "value"]),
  "vehicle-movements": fields(["vehicleId", "fromDriverId", "toDriverId", "cityId", "movementType", "handoverDate", "returnDate", "status", "notes"], [
    "vehicleId",
    "movementType",
  ]),
  "vehicle-cleaning": fields(["vehicleId", "driverId", "cleanDate", "cost", "status", "notes"], ["vehicleId"]),
  "vehicle-maintenance": fields(["vehicleId", "driverId", "type", "vendor", "cost", "status", "date", "notes"], ["vehicleId", "type"]),
  "vehicle-authorizations": fields(["vehicleId", "driverId", "authNumber", "startDate", "endDate", "status", "notes"], ["vehicleId"]),
  "rental-companies": fields(["name", "contact", "phone", "status", "notes"], ["name"]),
  "vehicle-costs": fields(
    ["vehicleId", "month", "rentCost", "maintenanceCost", "cleaningCost", "accidentCost", "damageCost", "otherCost", "totalCost", "status"],
    ["vehicleId", "month"],
  ),
  "vehicle-accidents": fields(["vehicleId", "driverId", "cityId", "type", "cost", "liabilityPercent", "status", "date", "notes"], ["vehicleId"]),
  "vehicle-damages": fields(["vehicleId", "driverId", "type", "estimatedCost", "finalCost", "status", "date", "notes"], ["vehicleId", "type"]),
  invoices: fields(["number", "client", "projectId", "month", "amount", "vatAmount", "status", "issuedAt", "dueDate"], ["number"]),
  receivables: fields(["client", "amount", "paidAmount", "dueDate", "status", "notes"], ["client"]),
  payments: fields(["payee", "amount", "method", "referenceNo", "status", "paidAt", "notes"], ["payee"]),
  expenses: fields(["type", "amount", "month", "status", "notes"], ["type"]),
  revenues: fields(["source", "amount", "month", "status", "notes"], ["source"]),
  "supplier-accounts": fields(["supplier", "balance", "dueDate", "status", "notes"], ["supplier"]),
  "cashbox-entries": fields(["type", "amount", "balance", "responsible", "status", "notes"], ["type"]),
  "bank-accounts": fields(["bankName", "iban", "balance", "status", "notes"], ["bankName"]),
  "vat-records": fields(["month", "salesVat", "purchaseVat", "netVat", "status"], ["month"]),
  "profit-loss": fields(["month", "revenues", "expenses", "payroll", "vehicleCosts", "netProfit", "status"], ["month"]),
  "quality-audits": fields(["entityType", "entityId", "result", "status", "reviewedBy", "notes"], ["entityType"]),
  "report-templates": fields(["name", "reportType", "columns", "filters", "status"], ["name", "reportType"]),
  "excel-mappings": fields(["name", "importType", "mapping", "status"], ["name", "importType", "mapping"]),
  "api-integrations": fields(["name", "provider", "status", "lastSyncAt", "settings"], ["name"]),
  "backup-records": fields(["fileName", "type", "status", "createdBy"], ["fileName", "type"]),
  "data-cleaning-issues": fields(["issueType", "entityType", "entityId", "severity", "status", "notes"], ["issueType", "entityType"]),
};

function fields(keys: string[], required: string[] = []): FormField[] {
  return keys.map((key) => ({
    key,
    label: fieldLabels[key] ?? key,
    required: required.includes(key),
    type: inferFieldType(key),
    options: inferFieldOptions(key),
  }));
}

function inferFieldType(key: string): FieldType {
  if (key === "notes" || key === "description" || key === "body") return "textarea";
  if (["value", "mapping", "settings", "columns", "filters", "errors", "oldValue", "newValue"].includes(key)) return "json";
  if (key === "isActive" || key === "isEmpty") return "checkbox";
  if (key === "status" || key === "severity" || key === "priority" || key === "role") return "select";
  if (isDateField(key)) return "date";
  if (isNumberField(key)) return "number";
  return "text";
}

function inferFieldOptions(key: string) {
  if (key === "severity" || key === "priority") return severityOptions;
  if (key === "role") {
    return [
      { label: "Admin", value: "ADMIN" },
      { label: "Operation Manager", value: "OPERATION_MANAGER" },
      { label: "Supervisor", value: "SUPERVISOR" },
      { label: "Accountant", value: "ACCOUNTANT" },
      { label: "HR", value: "HR" },
      { label: "Viewer", value: "VIEWER" },
    ];
  }
  if (key === "isActive" || key === "isEmpty") return booleanOptions;
  if (key === "status") return recordStatusOptions;
  return undefined;
}

function statusOptionsForResource(resourceKey: string) {
  if (resourceKey === "drivers") return driverStatusOptions;
  if (resourceKey === "vehicles") return vehicleStatusOptions;
  if (resourceKey === "payroll") return payrollStatusOptions;
  return recordStatusOptions;
}

function isDateField(key: string) {
  return (
    key.endsWith("At") ||
    key.endsWith("Date") ||
    ["reportDate", "dueDate", "occurredAt", "lockedAt", "workDate", "cleanDate", "handoverDate", "returnDate", "paidAt"].includes(key)
  );
}

function isNumberField(key: string) {
  return /amount|cost|rent|salary|bonus|deduction|balance|hours|rate|percent|orders|rows|target|riders|days|payroll|revenues|expenses|profit/i.test(key);
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusLabel(value: unknown) {
  const raw = String(value ?? "");
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    LOCKED: "مقفل",
    SUSPENDED: "موقوف",
    AVAILABLE: "متاحة",
    ASSIGNED: "مسلمة",
    MAINTENANCE: "صيانة",
    ACCIDENT: "حادث",
    DRAFT: "مسودة",
    UNDER_REVIEW: "تحت المراجعة",
    PAID: "مدفوع",
    CRITICAL: "حرج",
    WARNING: "تحذير",
    INFO: "معلومة",
  };
  return labels[raw] ?? raw;
}

function statusClass(value: unknown) {
  const raw = String(value ?? "");
  if (["ACTIVE", "APPROVED", "PAID", "AVAILABLE"].includes(raw)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["CRITICAL", "REJECTED", "SUSPENDED", "ACCIDENT"].includes(raw)) return "border-red-200 bg-red-50 text-red-700";
  if (["WARNING", "PENDING", "UNDER_REVIEW", "DRAFT", "MAINTENANCE"].includes(raw)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["INFO", "ASSIGNED"].includes(raw)) return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function fieldValue(row: Row | null, field: FormField) {
  const value = row?.[field.key];
  if (value === null || value === undefined) {
    if (field.type === "checkbox") return "false";
    return "";
  }
  if (field.type === "date" && typeof value === "string") return value.slice(0, 10);
  if (field.type === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

function csvEscape(value: unknown) {
  const text = formatCell(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildExportCsv(resource: ResourceConfig, rows: Row[], references: ReferenceData) {
  const headers = resource.columns.map((column) => column.label).join(",");
  const body = rows
    .map((row) => resource.columns.map((column) => csvEscape(referenceLabel(column.key, row[column.key], references) || row[column.key])).join(","))
    .join("\n");
  return `\uFEFF${headers}\n${body}`;
}

function downloadCsv(resource: ResourceConfig, rows: Row[], references: ReferenceData) {
  const blob = new Blob([buildExportCsv(resource, rows, references)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${resource.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPayload(fieldsList: FormField[], formData: FormData) {
  const payload: Record<string, unknown> = {};
  for (const field of fieldsList) {
    const raw = formData.get(field.key);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (!value && field.type !== "checkbox") continue;

    if (field.type === "checkbox") {
      payload[field.key] = value === "true";
    } else if (field.type === "number") {
      payload[field.key] = Number(value);
    } else if (field.type === "json") {
      payload[field.key] = value ? JSON.parse(value) : null;
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

function mergeFields(resource: ResourceConfig) {
  const preset = resourceFields[resource.key];
  if (preset) {
    return preset.map((field) => (field.key === "status" ? { ...field, options: statusOptionsForResource(resource.key) } : field));
  }

  const seen = new Set<string>();
  const keys = [...resource.columns.map((column) => column.key), ...resource.searchFields, "status", "notes"].filter(
    (key) => !["id", "createdAt", "updatedAt"].includes(key),
  );

  return keys
    .filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map<FormField>((key) => ({
      key,
      label: fieldLabels[key] ?? key,
      required: false,
      type: inferFieldType(key),
      options: key === "status" ? statusOptionsForResource(resource.key) : inferFieldOptions(key),
    }));
}

function quickFilterFields(resource: ResourceConfig) {
  const available = new Set([...resource.searchFields, ...resource.columns.map((column) => column.key)]);
  return [
    { key: "month", label: "الشهر", type: "text" },
    { key: "appName", label: "التطبيق", type: "text" },
    { key: "status", label: "الحالة", type: "select" },
    { key: "cityId", label: "المدينة", type: "text" },
    { key: "projectId", label: "المشروع", type: "text" },
    { key: "supervisorId", label: "المشرف", type: "text" },
  ].filter((field) => available.has(field.key));
}

function referenceKeyForField(key: string) {
  if (key === "cityId") return "cities";
  if (key === "projectId") return "projects";
  if (key === "supervisorId") return "supervisors";
  if (["driverId", "fromDriverId", "toDriverId", "currentDriverId", "convertedDriverId"].includes(key)) return "drivers";
  if (key === "vehicleId") return "vehicles";
  if (key === "accountId") return "accounts";
  return "";
}

function referenceLabel(field: string, value: unknown, references: ReferenceData) {
  const refKey = referenceKeyForField(field);
  if (!refKey || value === null || value === undefined || value === "") return "";
  const raw = String(value);
  return references[refKey]?.find((option) => option.value === raw)?.label ?? "";
}

function needsReferenceData(fieldsList: FormField[]) {
  return fieldsList.some((field) => Boolean(referenceKeyForField(field.key)));
}

const detailToneClass: Record<NonNullable<DetailCard["tone"]>, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

function ConnectedDetailPanel({
  detail,
  loading,
  error,
  activeTab,
  onTabChange,
}: {
  detail: DetailPayload | null;
  loading: boolean;
  error: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">جاري تحميل التفاصيل المتصلة...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{error}</div>;
  }

  if (!detail?.tabs.length) return null;

  const currentTab = detail.tabs.find((tab) => tab.key === activeTab) ?? detail.tabs[0];

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <h3 className="text-base font-black text-slate-950">{detail.title}</h3>
        {detail.subtitle ? <p className="mt-0.5 text-xs font-bold text-slate-500">{detail.subtitle}</p> : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {detail.tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black transition ${
              currentTab.key === tab.key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {currentTab.cards.map((card) => (
          <div key={`${currentTab.key}:${card.label}`} className={`rounded-xl border p-3 ${detailToneClass[card.tone ?? "slate"]}`}>
            <p className="text-xs font-black opacity-70">{card.label}</p>
            <strong className="mt-1 block text-lg font-black">{card.value}</strong>
          </div>
        ))}
      </div>

      {currentTab.rows?.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {currentTab.rows.map((row, index) => (
            <div key={`${currentTab.key}:${row.label}:${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="min-w-0 truncate text-sm font-black text-slate-900">{row.label}</strong>
                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">{row.value}</span>
              </div>
              {row.sub ? <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{row.sub}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">لا توجد بيانات متصلة كافية في هذا التبويب حالياً.</p>
      )}
    </section>
  );
}

export function ResourceWorkspace({ resource, compact = false }: { resource: ResourceConfig; compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [quickFilters, setQuickFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [references, setReferences] = useState<ReferenceData>({});
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailTab, setDetailTab] = useState("");
  const [page, setPage] = useState(1);

  const formFields = useMemo(() => mergeFields(resource), [resource]);
  const filters = useMemo(() => quickFilterFields(resource), [resource]);

  async function loadRows(nextQuery = activeQuery, nextFilters = quickFilters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("take", compact ? "50" : "300");
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      for (const [key, value] of Object.entries(nextFilters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      const res = await fetch(`${resource.api}?${params.toString()}`, { cache: "no-store" });
      const payload = (await res.json()) as ApiListResponse;
      if (!res.ok) throw new Error(payload.error ?? "تعذر تحميل البيانات");
      setRows(payload.data ?? []);
      setTotal(Number(payload.meta?.total ?? payload.data?.length ?? 0));
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows("");
  }, [resource.api]);

  useEffect(() => {
    if (!needsReferenceData(formFields) && !filters.some((field) => Boolean(referenceKeyForField(field.key)))) return;

    let active = true;
    fetch("/api/reference-data", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: { data?: ReferenceData }) => {
        if (active) setReferences(payload.data ?? {});
      })
      .catch(() => {
        if (active) setReferences({});
      });

    return () => {
      active = false;
    };
  }, [formFields]);

  function openCreate() {
    setSelected(null);
    setMode("create");
    setError("");
    setNotice("");
    setDetail(null);
    setDetailError("");
    setDetailTab("");
  }

  function openEdit(row: Row) {
    setSelected(row);
    setMode("edit");
    setError("");
    setNotice("");
    setDetail(null);
    setDetailError("");
    setDetailTab("");
  }

  async function loadDetails(row: Row) {
    if (!row.id || !["drivers", "supervisors"].includes(resource.key)) {
      setDetail(null);
      setDetailTab("");
      setDetailError("");
      return;
    }

    setDetailLoading(true);
    setDetail(null);
    setDetailError("");
    try {
      const res = await fetch(`/api/details/${resource.key}/${row.id}`, { cache: "no-store" });
      const payload = (await res.json()) as { data?: DetailPayload; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "تعذر تحميل التفاصيل المتصلة");
      setDetail(payload.data ?? null);
      setDetailTab(payload.data?.tabs[0]?.key ?? "");
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "تعذر تحميل التفاصيل المتصلة");
    } finally {
      setDetailLoading(false);
    }
  }

  function openView(row: Row) {
    setSelected(row);
    setMode("view");
    setError("");
    setNotice("");
    void loadDetails(row);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveQuery(query);
    await loadRows(query, quickFilters);
  }

  async function clearFilters() {
    setQuery("");
    setActiveQuery("");
    setQuickFilters({});
    await loadRows("", {});
  }

  async function handleSave(formData: FormData) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = buildPayload(formFields, formData);
      const url = mode === "edit" && selected?.id ? `${resource.api}/${selected.id}` : resource.api;
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(response.error ?? "تعذر حفظ السجل");
      setMode(null);
      setSelected(null);
      setNotice(mode === "edit" ? "تم تعديل السجل بنجاح." : "تمت إضافة السجل بنجاح.");
      await loadRows(activeQuery);
    } catch (err) {
      setError(err instanceof SyntaxError ? "صيغة JSON غير صحيحة في أحد الحقول." : err instanceof Error ? err.message : "تعذر حفظ السجل");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: Row) {
    if (!row.id) return;
    const ok = window.confirm("هل تريد حذف هذا السجل؟ لن يتم حذف أي بيانات أخرى مرتبطة به.");
    if (!ok) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${resource.api}/${row.id}`, { method: "DELETE" });
      const response = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(response.error ?? "تعذر حذف السجل");
      setNotice("تم حذف السجل بنجاح.");
      await loadRows(activeQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف السجل. قد يكون مرتبطا بسجلات أخرى.");
    } finally {
      setSaving(false);
    }
  }

  const empty = !loading && !error && rows.length === 0;
  const pageSize = compact ? 8 : 15;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const modalTitle = mode === "create" ? `إضافة ${resource.title}` : mode === "edit" ? `تعديل ${resource.title}` : `تفاصيل ${resource.title}`;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black text-slate-500">إجمالي السجلات</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <strong className="text-2xl font-black text-slate-950">{total}</strong>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                المعروض في الصفحة: {visibleRows.length} من {rows.length}
              </span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-4xl">
            <label htmlFor={`${resource.key}-search`} className="sr-only">
              بحث في {resource.title}
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                id={`${resource.key}-search`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالاسم، الكود، الحالة، المدينة، المشروع..."
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                بحث
              </button>
              <button
                type="button"
                onClick={() => void clearFilters()}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                disabled={loading}
              >
                مسح
              </button>
            </div>

            {filters.length ? (
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                {filters.map((field) => (
                  <label key={field.key} htmlFor={`${resource.key}-filter-${field.key}`} className="grid gap-1 text-xs font-black text-slate-500">
                    {field.label}
                    {field.type === "select" || referenceKeyForField(field.key) ? (
                      <select
                        id={`${resource.key}-filter-${field.key}`}
                        value={quickFilters[field.key] ?? ""}
                        onChange={(event) => setQuickFilters((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800"
                      >
                        <option value="">الكل</option>
                        {(referenceKeyForField(field.key)
                          ? references[referenceKeyForField(field.key)] ?? []
                          : statusOptionsForResource(resource.key)
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`${resource.key}-filter-${field.key}`}
                        value={quickFilters[field.key] ?? ""}
                        onChange={(event) => setQuickFilters((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800"
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : null}
          </form>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadRows(activeQuery)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              disabled={loading}
            >
              تحديث
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(resource, rows, references)}
              className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-100"
              disabled={!rows.length}
            >
              تصدير CSV
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              إضافة سجل
            </button>
          </div>
        </div>
      </div>

      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="table-scroll rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {resource.columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3">
                  {column.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3">الإجراءات</th>
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
                  <div className="mx-auto max-w-md">
                    <h3 className="text-base font-black text-slate-950">لا توجد بيانات محفوظة</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      استخدم زر إضافة سجل أو الاستيراد بالمعاينة لإدخال بيانات حقيقية بدون أرقام وهمية.
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading
              ? visibleRows.map((row) => (
                  <tr key={String(row.id ?? JSON.stringify(row))} className="hover:bg-slate-50">
                    {resource.columns.map((column) => {
                      const value = row[column.key];
                      const linkedLabel = referenceLabel(column.key, value, references);
                      const badge = ["status", "severity", "priority"].includes(column.key);
                      return (
                        <td key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                          {badge ? (
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(value)}`}>
                              {statusLabel(value)}
                            </span>
                          ) : (
                            <span>{linkedLabel || formatCell(value)}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openView(row)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          عرض
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 transition hover:bg-amber-100"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 transition hover:bg-red-100"
                          disabled={saving}
                        >
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
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
          <span>
            صفحة {currentPage} من {pageCount} - يتم عرض {visibleRows.length} سجل فقط لتخفيف الصفحة.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage >= pageCount}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">{modalTitle}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">المصدر: {resource.key}</p>
              </div>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>

            {mode === "view" ? (
              <div className="max-h-[72vh] space-y-3 overflow-auto p-4">
                <ConnectedDetailPanel
                  detail={detail}
                  loading={detailLoading}
                  error={detailError}
                  activeTab={detailTab}
                  onTabChange={setDetailTab}
                />

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-black text-slate-800">الحقول الخام للسجل</summary>
                  <dl className="mt-3 grid gap-2 md:grid-cols-2">
                    {Object.entries(selected ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <dt className="text-xs font-black text-slate-500">{fieldLabels[key] ?? key}</dt>
                        <dd className="mt-1 break-words text-sm font-bold text-slate-900">{referenceLabel(key, value, references) || formatCell(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            ) : (
              <form action={handleSave} className="max-h-[76vh] overflow-auto p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {formFields.map((field) => {
                    const fieldId = `${resource.key}-${field.key}`;
                    const currentValue = fieldValue(selected, field);
                    const referenceKey = referenceKeyForField(field.key);
                    const referenceOptions = referenceKey ? references[referenceKey] : undefined;
                    const baseOptions = field.key === "status" ? statusOptionsForResource(resource.key) : field.options;
                    const optionSource = referenceOptions ?? baseOptions;
                    const options =
                      currentValue && optionSource && !optionSource.some((option) => option.value === currentValue)
                        ? [{ label: `القيمة الحالية: ${currentValue}`, value: currentValue }, ...optionSource]
                        : optionSource;

                    return (
                      <label key={field.key} htmlFor={fieldId} className="grid gap-2 text-sm font-bold text-slate-700">
                        <span>
                          {field.label}
                          {field.required ? <span className="text-red-600"> *</span> : null}
                        </span>
                        {field.type === "textarea" || field.type === "json" ? (
                          <textarea
                            id={fieldId}
                            name={field.key}
                            defaultValue={currentValue}
                            required={field.required}
                            rows={field.type === "json" ? 5 : 3}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        ) : field.type === "select" || field.type === "checkbox" || options ? (
                          <select
                            id={fieldId}
                            name={field.key}
                            defaultValue={currentValue || (field.required ? options?.[0]?.value : "")}
                            required={field.required}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          >
                            {!field.required ? <option value="">غير محدد</option> : null}
                            {options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={fieldId}
                            name={field.key}
                            type={field.type ?? "text"}
                            defaultValue={currentValue}
                            required={field.required}
                            step={field.type === "number" ? "0.01" : undefined}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="sticky bottom-0 mt-5 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4">
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                    disabled={saving}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                  >
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
