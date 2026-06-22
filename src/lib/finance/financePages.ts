import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FinanceModuleKey =
  | "invoices"
  | "receivables"
  | "payments"
  | "expenses"
  | "revenues"
  | "deductions"
  | "supplier-accounts"
  | "cashbox-entries"
  | "bank-accounts"
  | "vat-records"
  | "profit-loss"
  | "vehicle-costs"
  | "financial-reports";

export type FinanceFilters = {
  fromDate: string;
  toDate: string;
  month: string;
  status: string;
  applicationProjectId: string;
  cityId: string;
  q: string;
  pageSize: number;
};

export type FinanceColumn = {
  key: string;
  label: string;
  money?: boolean;
};

export type FinanceRow = {
  id: string;
  primary: string;
  status: string;
  amount: number;
  date: string;
  cityId: string;
  applicationProjectId: string;
  cells: Record<string, string | number>;
  raw: Record<string, string | number | boolean | null>;
};

export type FinanceReference = {
  id: string;
  label: string;
  cityId?: string;
};

export type FinanceModuleDefinition = {
  key: FinanceModuleKey;
  title: string;
  description: string;
  route: string;
  api: string;
  columns: FinanceColumn[];
  formFields: string[];
};

export type FinanceModulePageData = {
  databaseOffline: boolean;
  filters: FinanceFilters;
  module: FinanceModuleDefinition;
  rows: FinanceRow[];
  summary: {
    total: number;
    approved: number;
    pending: number;
    paidOrLocked: number;
    totalAmount: number;
    approvedAmount: number;
    openAmount: number;
  };
  refs: {
    applicationProjects: FinanceReference[];
    cities: FinanceReference[];
    drivers: FinanceReference[];
    vehicles: FinanceReference[];
  };
  insight: string;
};

export type FinanceOverviewData = {
  databaseOffline: boolean;
  filters: FinanceFilters;
  summary: {
    registeredRevenue: number;
    keetaRevenue: number;
    totalRevenue: number;
    registeredExpenses: number;
    payrollCost: number;
    advances: number;
    deductions: number;
    violations: number;
    fuel: number;
    vehicleCosts: number;
    receivablesOpen: number;
    payments: number;
    cashboxBalance: number;
    bankBalance: number;
    estimatedProfit: number;
  };
  modules: Array<{
    href: string;
    title: string;
    description: string;
    total: number;
    amount: number;
    tone: "slate" | "emerald" | "amber" | "red" | "blue";
  }>;
  alerts: string[];
  topRows: Array<{ label: string; value: number; sub: string }>;
};

const moduleDefinitions: Record<FinanceModuleKey, FinanceModuleDefinition> = {
  invoices: {
    key: "invoices",
    title: "الفواتير العامة",
    description: "فواتير العملاء والتطبيقات العامة. فواتير المشاريع التشغيلية تدار من داخل Workspace المشروع.",
    route: "/invoices",
    api: "/api/invoices",
    columns: [
      { key: "number", label: "رقم الفاتورة" },
      { key: "client", label: "العميل" },
      { key: "project", label: "المشروع" },
      { key: "month", label: "الشهر" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "vatAmount", label: "VAT", money: true },
      { key: "invoiceStatus", label: "حالة الفاتورة" },
      { key: "issuedAt", label: "تاريخ الإصدار" },
      { key: "dueDate", label: "تاريخ الاستحقاق" },
    ],
    formFields: ["number", "client", "applicationProjectId", "month", "amount", "vatAmount", "invoiceStatus", "status", "issuedAt", "dueDate"],
  },
  receivables: {
    key: "receivables",
    title: "المستحقات",
    description: "المبالغ المستحقة على العملاء والتطبيقات وموقف التحصيل.",
    route: "/receivables",
    api: "/api/receivables",
    columns: [
      { key: "client", label: "العميل" },
      { key: "amount", label: "المستحق", money: true },
      { key: "paidAmount", label: "المدفوع", money: true },
      { key: "remaining", label: "المتبقي", money: true },
      { key: "dueDate", label: "تاريخ الاستحقاق" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["client", "amount", "paidAmount", "dueDate", "status", "notes"],
  },
  payments: {
    key: "payments",
    title: "المدفوعات",
    description: "مدفوعات الموردين والرواتب والمصروفات مع رقم المرجع وطريقة السداد.",
    route: "/payments",
    api: "/api/payments",
    columns: [
      { key: "payee", label: "المستفيد" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "method", label: "طريقة الدفع" },
      { key: "referenceNo", label: "رقم المرجع" },
      { key: "paidAt", label: "تاريخ الدفع" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["payee", "amount", "method", "referenceNo", "status", "paidAt", "notes"],
  },
  expenses: {
    key: "expenses",
    title: "المصروفات",
    description: "مصروفات التشغيل العامة حسب النوع والشهر والحالة.",
    route: "/expenses",
    api: "/api/expenses",
    columns: [
      { key: "type", label: "نوع المصروف" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "month", label: "الشهر" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["type", "amount", "month", "status", "notes"],
  },
  revenues: {
    key: "revenues",
    title: "الإيرادات",
    description: "إيرادات المشاريع والفواتير المعتمدة ومصادر الدخل.",
    route: "/revenues",
    api: "/api/revenues",
    columns: [
      { key: "source", label: "المصدر" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "month", label: "الشهر" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["source", "amount", "month", "status", "notes"],
  },
  deductions: {
    key: "deductions",
    title: "الخصومات",
    description: "خصومات المناديب اليدوية والتشغيلية وموقف تسميعها في المسير.",
    route: "/deductions",
    api: "/api/deductions",
    columns: [
      { key: "driver", label: "المندوب" },
      { key: "type", label: "نوع الخصم" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "month", label: "شهر الخصم" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["driverId", "type", "amount", "month", "status", "notes"],
  },
  "supplier-accounts": {
    key: "supplier-accounts",
    title: "حسابات الموردين",
    description: "أرصدة الموردين وشركات التأجير وتواريخ الاستحقاق.",
    route: "/supplier-accounts",
    api: "/api/supplier-accounts",
    columns: [
      { key: "supplier", label: "المورد" },
      { key: "balance", label: "الرصيد", money: true },
      { key: "dueDate", label: "تاريخ الاستحقاق" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["supplier", "balance", "dueDate", "status", "notes"],
  },
  "cashbox-entries": {
    key: "cashbox-entries",
    title: "العهدة والصندوق",
    description: "حركة العهدة والصندوق والمسؤول عن كل حركة.",
    route: "/custody-cashbox",
    api: "/api/cashbox-entries",
    columns: [
      { key: "type", label: "نوع الحركة" },
      { key: "amount", label: "المبلغ", money: true },
      { key: "balance", label: "الرصيد", money: true },
      { key: "responsible", label: "المسؤول" },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["type", "amount", "balance", "responsible", "status", "notes"],
  },
  "bank-accounts": {
    key: "bank-accounts",
    title: "الحسابات البنكية",
    description: "الحسابات البنكية والأرصدة والتسويات.",
    route: "/bank-accounts",
    api: "/api/bank-accounts",
    columns: [
      { key: "bankName", label: "البنك" },
      { key: "iban", label: "IBAN" },
      { key: "balance", label: "الرصيد", money: true },
      { key: "status", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    formFields: ["bankName", "iban", "balance", "status", "notes"],
  },
  "vat-records": {
    key: "vat-records",
    title: "ضريبة القيمة المضافة",
    description: "سجلات VAT حسب الشهر وموقف الاعتماد.",
    route: "/vat",
    api: "/api/vat-records",
    columns: [
      { key: "month", label: "الشهر" },
      { key: "salesVat", label: "ضريبة المبيعات", money: true },
      { key: "purchaseVat", label: "ضريبة المشتريات", money: true },
      { key: "netVat", label: "صافي الضريبة", money: true },
      { key: "status", label: "الحالة" },
    ],
    formFields: ["month", "salesVat", "purchaseVat", "netVat", "status"],
  },
  "profit-loss": {
    key: "profit-loss",
    title: "الأرباح والخسائر",
    description: "تحليل الإيرادات والمصروفات والرواتب وتكاليف السيارات وصافي الربح.",
    route: "/profit-loss",
    api: "/api/profit-loss",
    columns: [
      { key: "month", label: "الشهر" },
      { key: "revenues", label: "الإيرادات", money: true },
      { key: "expenses", label: "المصروفات", money: true },
      { key: "payroll", label: "الرواتب", money: true },
      { key: "vehicleCosts", label: "تكلفة السيارات", money: true },
      { key: "netProfit", label: "صافي الربح", money: true },
      { key: "status", label: "الحالة" },
    ],
    formFields: ["month", "revenues", "expenses", "payroll", "vehicleCosts", "netProfit", "status"],
  },
  "vehicle-costs": {
    key: "vehicle-costs",
    title: "مالية السيارات",
    description: "تكاليف السيارات الشهرية كتكلفة شركة: إيجار، صيانة، نظافة، حوادث، وتلفيات.",
    route: "/vehicle-finance",
    api: "/api/vehicle-costs",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "month", label: "الشهر" },
      { key: "rentCost", label: "الإيجار", money: true },
      { key: "maintenanceCost", label: "الصيانة", money: true },
      { key: "cleaningCost", label: "النظافة", money: true },
      { key: "accidentCost", label: "الحوادث", money: true },
      { key: "damageCost", label: "التلفيات", money: true },
      { key: "totalCost", label: "الإجمالي", money: true },
      { key: "status", label: "الحالة" },
    ],
    formFields: ["vehicleId", "month", "rentCost", "maintenanceCost", "cleaningCost", "accidentCost", "damageCost", "otherCost", "totalCost", "status"],
  },
  "financial-reports": {
    key: "financial-reports",
    title: "التقارير المالية",
    description: "تقرير مالي مجمع من الإيرادات والرواتب والمصروفات والخصومات المعتمدة.",
    route: "/financial-reports",
    api: "",
    columns: [
      { key: "item", label: "البند" },
      { key: "amount", label: "القيمة", money: true },
      { key: "source", label: "مصدر البيانات" },
      { key: "status", label: "الحالة" },
    ],
    formFields: [],
  },
};

function valueOf(param: string | string[] | undefined, fallback = "") {
  if (Array.isArray(param)) return param[0] ?? fallback;
  return param ?? fallback;
}

export function resolveFinanceFilters(searchParams: Record<string, string | string[] | undefined>): FinanceFilters {
  return {
    fromDate: valueOf(searchParams.fromDate),
    toDate: valueOf(searchParams.toDate),
    month: valueOf(searchParams.month),
    status: valueOf(searchParams.status),
    applicationProjectId: valueOf(searchParams.applicationProjectId),
    cityId: valueOf(searchParams.cityId),
    q: valueOf(searchParams.q),
    pageSize: Math.min(Math.max(Number(valueOf(searchParams.pageSize, "50")) || 50, 10), 300),
  };
}

function toNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function monthText(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function statusText(value: unknown) {
  return String(value ?? "-");
}

function approvedStatus(value: string) {
  return ["APPROVED", "LOCKED", "PAID", "ACTIVE", "Approved", "Locked", "Paid"].includes(value);
}

function paidOrLockedStatus(value: string) {
  return ["LOCKED", "PAID", "Locked", "Paid"].includes(value);
}

function pendingStatus(value: string) {
  return ["PENDING", "DRAFT", "UNDER_REVIEW", "Draft", "Uploaded", "Reviewed"].includes(value);
}

function matchesFilters(row: FinanceRow, filters: FinanceFilters) {
  if (filters.month && !Object.values(row.cells).some((value) => String(value).includes(filters.month))) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.applicationProjectId && row.applicationProjectId !== filters.applicationProjectId) return false;
  if (filters.cityId && row.cityId !== filters.cityId) return false;
  if (filters.fromDate && row.date && row.date < filters.fromDate) return false;
  if (filters.toDate && row.date && row.date > filters.toDate) return false;
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const haystack = [row.primary, row.status, ...Object.values(row.cells), ...Object.values(row.raw)]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function summarize(rows: FinanceRow[]) {
  return {
    total: rows.length,
    approved: rows.filter((row) => approvedStatus(row.status)).length,
    pending: rows.filter((row) => pendingStatus(row.status)).length,
    paidOrLocked: rows.filter((row) => paidOrLockedStatus(row.status)).length,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    approvedAmount: rows.filter((row) => approvedStatus(row.status)).reduce((sum, row) => sum + row.amount, 0),
    openAmount: rows.filter((row) => !paidOrLockedStatus(row.status)).reduce((sum, row) => sum + row.amount, 0),
  };
}

function emptyModule(key: FinanceModuleKey, filters: FinanceFilters, offline = false): FinanceModulePageData {
  return {
    databaseOffline: offline,
    filters,
    module: moduleDefinitions[key],
    rows: [],
    summary: summarize([]),
    refs: { applicationProjects: [], cities: [], drivers: [], vehicles: [] },
    insight: offline ? "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة." : "لا توجد بيانات كافية لإظهار تحليل دقيق حالياً.",
  };
}

async function refs() {
  const [applicationProjects, cities, drivers, vehicles] = await Promise.all([
    prisma.applicationProject.findMany({
      include: { application: true, city: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.city.findMany({ orderBy: { nameAr: "asc" }, take: 500 }),
    prisma.driver.findMany({ select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true }, orderBy: { name: "asc" }, take: 800 }),
    prisma.vehicle.findMany({ select: { id: true, plateArabic: true, plateEnglish: true, plateAr: true, plateEn: true, vehicleCode: true, model: true }, orderBy: { updatedAt: "desc" }, take: 800 }),
  ]);

  return {
    applicationProjects: applicationProjects.map((project) => ({
      id: project.id,
      label: `${project.application?.name || ""} - ${project.city?.nameAr || project.city?.nameEn || project.name}`.trim(),
      cityId: project.cityId || "",
    })),
    cities: cities.map((city) => ({ id: city.id, label: city.nameAr || city.nameEn || city.id })),
    drivers: drivers.map((driver) => ({ id: driver.id, label: `${driver.actualName || driver.name} - ${driver.driverCode || driver.internalCode || driver.id}` })),
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: [vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.vehicleCode, vehicle.model].filter(Boolean).join(" - "),
    })),
  };
}

function projectName(project: { name: string; application?: { name: string } | null; city?: { nameAr: string; nameEn?: string | null } | null } | null | undefined) {
  if (!project) return "-";
  return [project.application?.name, project.city?.nameAr || project.city?.nameEn || project.name].filter(Boolean).join(" - ");
}

function driverName(driver: { name: string; actualName?: string | null; internalCode?: string | null; driverCode?: string | null } | null | undefined) {
  if (!driver) return "-";
  return `${driver.actualName || driver.name}${driver.driverCode || driver.internalCode ? ` - ${driver.driverCode || driver.internalCode}` : ""}`;
}

async function loadRows(key: FinanceModuleKey, filters: FinanceFilters): Promise<FinanceRow[]> {
  switch (key) {
    case "invoices": {
      const rows = await prisma.invoice.findMany({ include: { applicationProject: { include: { application: true, city: true } } }, orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.number,
        status: row.invoiceStatus || statusText(row.status),
        amount: toNumber(row.amount),
        date: dateOnly(row.issuedAt || row.createdAt),
        cityId: row.applicationProject?.cityId || "",
        applicationProjectId: row.applicationProjectId || "",
        cells: {
          number: row.number,
          client: row.client || "-",
          project: projectName(row.applicationProject),
          month: row.month || "-",
          amount: toNumber(row.amount),
          vatAmount: toNumber(row.vatAmount),
          invoiceStatus: row.invoiceStatus || statusText(row.status),
          issuedAt: dateOnly(row.issuedAt),
          dueDate: dateOnly(row.dueDate),
        },
        raw: {
          number: row.number,
          client: row.client,
          applicationProjectId: row.applicationProjectId,
          month: row.month,
          amount: toNumber(row.amount),
          vatAmount: toNumber(row.vatAmount),
          invoiceStatus: row.invoiceStatus,
          status: statusText(row.status),
          issuedAt: dateOnly(row.issuedAt),
          dueDate: dateOnly(row.dueDate),
        },
      }));
    }
    case "receivables": {
      const rows = await prisma.receivable.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => {
        const amount = toNumber(row.amount);
        const paid = toNumber(row.paidAmount);
        return {
          id: row.id,
          primary: row.client,
          status: statusText(row.status),
          amount,
          date: dateOnly(row.dueDate || row.createdAt),
          cityId: "",
          applicationProjectId: "",
          cells: { client: row.client, amount, paidAmount: paid, remaining: Math.max(0, amount - paid), dueDate: dateOnly(row.dueDate), status: statusText(row.status), notes: row.notes || "-" },
          raw: { client: row.client, amount, paidAmount: paid, dueDate: dateOnly(row.dueDate), status: statusText(row.status), notes: row.notes },
        };
      });
    }
    case "payments": {
      const rows = await prisma.payment.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.payee,
        status: statusText(row.status),
        amount: toNumber(row.amount),
        date: dateOnly(row.paidAt || row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { payee: row.payee, amount: toNumber(row.amount), method: row.method || "-", referenceNo: row.referenceNo || "-", paidAt: dateOnly(row.paidAt), status: statusText(row.status), notes: row.notes || "-" },
        raw: { payee: row.payee, amount: toNumber(row.amount), method: row.method, referenceNo: row.referenceNo, status: statusText(row.status), paidAt: dateOnly(row.paidAt), notes: row.notes },
      }));
    }
    case "expenses": {
      const rows = await prisma.expense.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.type,
        status: statusText(row.status),
        amount: toNumber(row.amount),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { type: row.type, amount: toNumber(row.amount), month: row.month || "-", status: statusText(row.status), notes: row.notes || "-" },
        raw: { type: row.type, amount: toNumber(row.amount), month: row.month, status: statusText(row.status), notes: row.notes },
      }));
    }
    case "revenues": {
      const rows = await prisma.revenue.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.source,
        status: statusText(row.status),
        amount: toNumber(row.amount),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { source: row.source, amount: toNumber(row.amount), month: row.month || "-", status: statusText(row.status), notes: row.notes || "-" },
        raw: { source: row.source, amount: toNumber(row.amount), month: row.month, status: statusText(row.status), notes: row.notes },
      }));
    }
    case "deductions": {
      const rows = await prisma.deduction.findMany({ include: { driver: { include: { city: true, applicationAccounts: { include: { applicationProject: { include: { application: true, city: true } } }, take: 1 } } } }, orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => {
        const project = row.driver.applicationAccounts[0]?.applicationProject ?? null;
        return {
          id: row.id,
          primary: driverName(row.driver),
          status: statusText(row.status),
          amount: toNumber(row.amount),
          date: dateOnly(row.createdAt),
          cityId: row.driver.cityId || project?.cityId || "",
          applicationProjectId: project?.id || "",
          cells: { driver: driverName(row.driver), type: row.type, amount: toNumber(row.amount), month: row.month || "-", status: statusText(row.status), notes: row.notes || "-" },
          raw: { driverId: row.driverId, type: row.type, amount: toNumber(row.amount), month: row.month, status: statusText(row.status), notes: row.notes },
        };
      });
    }
    case "supplier-accounts": {
      const rows = await prisma.supplierAccount.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.supplier,
        status: statusText(row.status),
        amount: toNumber(row.balance),
        date: dateOnly(row.dueDate || row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { supplier: row.supplier, balance: toNumber(row.balance), dueDate: dateOnly(row.dueDate), status: statusText(row.status), notes: row.notes || "-" },
        raw: { supplier: row.supplier, balance: toNumber(row.balance), dueDate: dateOnly(row.dueDate), status: statusText(row.status), notes: row.notes },
      }));
    }
    case "cashbox-entries": {
      const rows = await prisma.cashboxEntry.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.type,
        status: statusText(row.status),
        amount: toNumber(row.amount),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { type: row.type, amount: toNumber(row.amount), balance: toNumber(row.balance), responsible: row.responsible || "-", status: statusText(row.status), notes: row.notes || "-" },
        raw: { type: row.type, amount: toNumber(row.amount), balance: toNumber(row.balance), responsible: row.responsible, status: statusText(row.status), notes: row.notes },
      }));
    }
    case "bank-accounts": {
      const rows = await prisma.bankAccount.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.bankName,
        status: statusText(row.status),
        amount: toNumber(row.balance),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { bankName: row.bankName, iban: row.iban || "-", balance: toNumber(row.balance), status: statusText(row.status), notes: row.notes || "-" },
        raw: { bankName: row.bankName, iban: row.iban, balance: toNumber(row.balance), status: statusText(row.status), notes: row.notes },
      }));
    }
    case "vat-records": {
      const rows = await prisma.vatRecord.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.month,
        status: statusText(row.status),
        amount: toNumber(row.netVat),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { month: row.month, salesVat: toNumber(row.salesVat), purchaseVat: toNumber(row.purchaseVat), netVat: toNumber(row.netVat), status: statusText(row.status) },
        raw: { month: row.month, salesVat: toNumber(row.salesVat), purchaseVat: toNumber(row.purchaseVat), netVat: toNumber(row.netVat), status: statusText(row.status) },
      }));
    }
    case "profit-loss": {
      const rows = await prisma.profitLossRecord.findMany({ orderBy: { month: "desc" }, take: 1000 });
      return rows.map((row) => ({
        id: row.id,
        primary: row.month,
        status: statusText(row.status),
        amount: toNumber(row.netProfit),
        date: dateOnly(row.createdAt),
        cityId: "",
        applicationProjectId: "",
        cells: { month: row.month, revenues: toNumber(row.revenues), expenses: toNumber(row.expenses), payroll: toNumber(row.payroll), vehicleCosts: toNumber(row.vehicleCosts), netProfit: toNumber(row.netProfit), status: statusText(row.status) },
        raw: { month: row.month, revenues: toNumber(row.revenues), expenses: toNumber(row.expenses), payroll: toNumber(row.payroll), vehicleCosts: toNumber(row.vehicleCosts), netProfit: toNumber(row.netProfit), status: statusText(row.status) },
      }));
    }
    case "vehicle-costs": {
      const [rows, vehicles] = await Promise.all([
        prisma.vehicleCost.findMany({ orderBy: { updatedAt: "desc" }, take: 1000 }),
        prisma.vehicle.findMany({ select: { id: true, plateArabic: true, plateEnglish: true, plateAr: true, plateEn: true, vehicleCode: true, cityId: true }, take: 1000 }),
      ]);
      const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
      return rows.map((row) => {
        const vehicle = vehicleById.get(row.vehicleId);
        const vehicleLabel = vehicle ? vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.vehicleCode || vehicle.id : row.vehicleId;
        return {
          id: row.id,
          primary: vehicleLabel,
          status: statusText(row.status),
          amount: toNumber(row.totalCost),
          date: dateOnly(row.createdAt),
          cityId: vehicle?.cityId || "",
          applicationProjectId: "",
          cells: {
            vehicle: vehicleLabel,
            month: row.month,
            rentCost: toNumber(row.rentCost),
            maintenanceCost: toNumber(row.maintenanceCost),
            cleaningCost: toNumber(row.cleaningCost),
            accidentCost: toNumber(row.accidentCost),
            damageCost: toNumber(row.damageCost),
            totalCost: toNumber(row.totalCost),
            status: statusText(row.status),
          },
          raw: {
            vehicleId: row.vehicleId,
            month: row.month,
            rentCost: toNumber(row.rentCost),
            maintenanceCost: toNumber(row.maintenanceCost),
            cleaningCost: toNumber(row.cleaningCost),
            accidentCost: toNumber(row.accidentCost),
            damageCost: toNumber(row.damageCost),
            otherCost: toNumber(row.otherCost),
            totalCost: toNumber(row.totalCost),
            status: statusText(row.status),
          },
        };
      });
    }
    case "financial-reports": {
      const overview = await getFinanceOverviewData(filters);
      return [
        rowFromReport("revenue", "إجمالي الإيرادات", overview.summary.totalRevenue, "إيرادات مسجلة + مستحق كيتا المعتمد", "APPROVED"),
        rowFromReport("keeta-revenue", "مستحق الشركة من كيتا", overview.summary.keetaRevenue, "KeetaInvoiceRecord المعتمد", "APPROVED"),
        rowFromReport("payroll", "تكلفة الرواتب", overview.summary.payrollCost, "PayrollRun Approved/Locked/Paid", "APPROVED"),
        rowFromReport("expenses", "المصروفات", overview.summary.registeredExpenses, "Expense", "APPROVED"),
        rowFromReport("vehicle-costs", "تكلفة السيارات", overview.summary.vehicleCosts, "VehicleCost", "APPROVED"),
        rowFromReport("deductions", "خصومات المناديب", overview.summary.deductions, "Deduction", "APPROVED"),
        rowFromReport("estimated-profit", "الربح التقديري", overview.summary.estimatedProfit, "إيرادات - رواتب - مصروفات - تكلفة سيارات", overview.summary.estimatedProfit >= 0 ? "APPROVED" : "PENDING"),
      ];
    }
  }
}

function rowFromReport(id: string, item: string, amount: number, source: string, status: string): FinanceRow {
  return {
    id,
    primary: item,
    status,
    amount,
    date: "",
    cityId: "",
    applicationProjectId: "",
    cells: { item, amount, source, status },
    raw: {},
  };
}

export async function getFinanceModulePageData(key: FinanceModuleKey, filters: FinanceFilters): Promise<FinanceModulePageData> {
  try {
    const allRows = await loadRows(key, filters);
    const pageRows = allRows.filter((row) => matchesFilters(row, filters)).slice(0, filters.pageSize);
    const summary = summarize(pageRows);
    const referenceData = await refs();
    const insight = pageRows.length
      ? `${moduleDefinitions[key].title}: يوجد ${summary.total} سجل بإجمالي ${Math.round(summary.totalAmount).toLocaleString("ar-SA")} ريال ضمن الفلاتر الحالية.`
      : "لا توجد بيانات كافية لإظهار تحليل دقيق حالياً.";

    return {
      databaseOffline: false,
      filters,
      module: moduleDefinitions[key],
      rows: pageRows,
      summary,
      refs: referenceData,
      insight,
    };
  } catch {
    return emptyModule(key, filters, true);
  }
}

function dateWhere(filters: FinanceFilters, field: "createdAt" | "issuedAt" | "advanceDate" | "occurredAt" | "fuelDate" | "entryDate") {
  const range: Record<string, Date> = {};
  if (filters.fromDate) range.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
  if (filters.toDate) range.lte = new Date(`${filters.toDate}T23:59:59.999Z`);
  return Object.keys(range).length ? { [field]: range } : {};
}

export async function getFinanceOverviewData(filters: FinanceFilters): Promise<FinanceOverviewData> {
  try {
    const payrollWhere: Prisma.PayrollRunWhereInput = {
      status: { in: ["APPROVED", "LOCKED", "PAID"] },
      ...(filters.month ? { month: Number(filters.month.slice(-2)), year: Number(filters.month.slice(0, 4)) } : {}),
      ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
    };
    const invoiceWhere: Prisma.KeetaInvoiceRecordWhereInput = {
      status: { in: ["APPROVED", "LOCKED", "PAID", "ACTIVE"] as never },
      ...(filters.month ? { month: filters.month } : {}),
      ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
    };

    const [
      revenues,
      expenses,
      invoices,
      keetaInvoices,
      payrollRuns,
      advances,
      deductions,
      violations,
      fuelRecords,
      vehicleCosts,
      receivables,
      payments,
      cashboxEntries,
      bankAccounts,
    ] = await Promise.all([
      prisma.revenue.findMany({ where: { ...dateWhere(filters, "createdAt") }, take: 2000 }),
      prisma.expense.findMany({ where: { ...dateWhere(filters, "createdAt") }, take: 2000 }),
      prisma.invoice.findMany({ where: { ...dateWhere(filters, "issuedAt") }, take: 2000 }),
      prisma.keetaInvoiceRecord.findMany({ where: invoiceWhere, take: 5000 }),
      prisma.payrollRun.findMany({ where: payrollWhere, take: 1000 }),
      prisma.advance.findMany({ where: { ...dateWhere(filters, "advanceDate") }, take: 2000 }),
      prisma.deduction.findMany({ where: { ...dateWhere(filters, "createdAt") }, take: 2000 }),
      prisma.violation.findMany({ where: { ...dateWhere(filters, "occurredAt") }, take: 2000 }),
      prisma.fuelRecord.findMany({ where: { ...dateWhere(filters, "fuelDate") }, take: 2000 }),
      prisma.vehicleCost.findMany({ take: 2000 }),
      prisma.receivable.findMany({ take: 2000 }),
      prisma.payment.findMany({ take: 2000 }),
      prisma.cashboxEntry.findMany({ take: 2000 }),
      prisma.bankAccount.findMany({ take: 2000 }),
    ]);

    const registeredRevenue = revenues.reduce((sum, row) => sum + toNumber(row.amount), 0) + invoices.filter((row) => approvedStatus(row.invoiceStatus || statusText(row.status))).reduce((sum, row) => sum + toNumber(row.amount), 0);
    const keetaRevenue = keetaInvoices.reduce((sum, row) => sum + toNumber(row.totalPayableAmount), 0);
    const registeredExpenses = expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const payrollCost = payrollRuns.reduce((sum, row) => sum + toNumber(row.netTotal), 0);
    const vehicleCostTotal = vehicleCosts.reduce((sum, row) => sum + toNumber(row.totalCost), 0);
    const summary = {
      registeredRevenue,
      keetaRevenue,
      totalRevenue: registeredRevenue + keetaRevenue,
      registeredExpenses,
      payrollCost,
      advances: advances.reduce((sum, row) => sum + toNumber(row.amount), 0),
      deductions: deductions.reduce((sum, row) => sum + toNumber(row.amount), 0),
      violations: violations.reduce((sum, row) => sum + toNumber(row.amount), 0),
      fuel: fuelRecords.reduce((sum, row) => sum + toNumber(row.amount), 0),
      vehicleCosts: vehicleCostTotal,
      receivablesOpen: receivables.reduce((sum, row) => sum + Math.max(0, toNumber(row.amount) - toNumber(row.paidAmount)), 0),
      payments: payments.reduce((sum, row) => sum + toNumber(row.amount), 0),
      cashboxBalance: cashboxEntries.reduce((sum, row) => sum + toNumber(row.balance), 0),
      bankBalance: bankAccounts.reduce((sum, row) => sum + toNumber(row.balance), 0),
      estimatedProfit: registeredRevenue + keetaRevenue - registeredExpenses - payrollCost - vehicleCostTotal,
    };

    const modules = [
      moduleCard("/invoices", "الفواتير العامة", "فواتير العملاء العامة", invoices.length, invoices.reduce((sum, row) => sum + toNumber(row.amount), 0), "blue" as const),
      moduleCard("/receivables", "المستحقات", "مبالغ مفتوحة للتحصيل", receivables.length, summary.receivablesOpen, "amber" as const),
      moduleCard("/payments", "المدفوعات", "حركة السداد", payments.length, summary.payments, "red" as const),
      moduleCard("/expenses", "المصروفات", "مصروفات التشغيل", expenses.length, registeredExpenses, "red" as const),
      moduleCard("/revenues", "الإيرادات", "إيرادات مسجلة", revenues.length, registeredRevenue, "emerald" as const),
      moduleCard("/advances", "السلف", "سلف المناديب", advances.length, summary.advances, "amber" as const),
      moduleCard("/deductions", "الخصومات", "خصومات المناديب", deductions.length, summary.deductions, "red" as const),
      moduleCard("/vehicle-finance", "مالية السيارات", "تكاليف السيارات", vehicleCosts.length, vehicleCostTotal, "blue" as const),
      moduleCard("/profit-loss", "الأرباح والخسائر", "صافي الربح التقديري", payrollRuns.length, summary.estimatedProfit, summary.estimatedProfit >= 0 ? "emerald" as const : "red" as const),
    ];

    const alerts = [
      summary.receivablesOpen > 0 ? `يوجد مستحقات مفتوحة بقيمة ${Math.round(summary.receivablesOpen).toLocaleString("ar-SA")} ريال.` : "",
      summary.estimatedProfit < 0 ? "الربح التقديري بالسالب ضمن الفلاتر الحالية." : "",
      payrollRuns.some((run) => statusText(run.status) === "APPROVED") ? "" : "لا توجد مسيرات معتمدة ضمن الفلاتر الحالية.",
    ].filter(Boolean);

    const topRows = payrollRuns
      .sort((a, b) => toNumber(b.totalCompanyRevenue) - toNumber(a.totalCompanyRevenue))
      .slice(0, 5)
      .map((row) => ({ label: monthText(row.month, row.year), value: toNumber(row.totalCompanyRevenue), sub: "إيراد مشروع معتمد" }));

    return { databaseOffline: false, filters, summary, modules, alerts, topRows };
  } catch {
    return {
      databaseOffline: true,
      filters,
      summary: {
        registeredRevenue: 0,
        keetaRevenue: 0,
        totalRevenue: 0,
        registeredExpenses: 0,
        payrollCost: 0,
        advances: 0,
        deductions: 0,
        violations: 0,
        fuel: 0,
        vehicleCosts: 0,
        receivablesOpen: 0,
        payments: 0,
        cashboxBalance: 0,
        bankBalance: 0,
        estimatedProfit: 0,
      },
      modules: [],
      alerts: ["قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة."],
      topRows: [],
    };
  }
}

function moduleCard(href: string, title: string, description: string, total: number, amount: number, tone: "slate" | "emerald" | "amber" | "red" | "blue") {
  return { href, title, description, total, amount, tone };
}
