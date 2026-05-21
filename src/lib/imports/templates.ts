import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ImportColumn = {
  key: string;
  displayName: string;
  required?: boolean;
  dataType: "string" | "number" | "date" | "boolean";
  aliases?: string[];
};

export type ImportColumnMapping = {
  incomingColumn: string;
  systemField: string;
  required?: boolean;
  transformRule?: string;
};

export type ImportTemplateDefinition = {
  fileType: string;
  name: string;
  category: "drivers" | "vehicles" | "applications" | "operations" | "finance" | "hr" | "payroll";
  applicationCode?: "KEETA" | "HUNGERSTATION" | "TALABAT";
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
  matchingFields: string[];
  uniqueKeys: string[];
};

export type ImportTemplateRow = {
  id: string;
  source: "database" | "builtin";
  name: string;
  fileType: string;
  category: string;
  applicationId: string;
  applicationName: string;
  applicationProjectId: string;
  projectName: string;
  requiredColumnsCount: number;
  optionalColumnsCount: number;
  mappingStatus: string;
  lastUsedAt: string;
  status: string;
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
};

export type ImportTemplatesData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  summary: {
    total: number;
    active: number;
    applicationTemplates: number;
    driverTemplates: number;
    vehicleTemplates: number;
    financeTemplates: number;
    needsMapping: number;
    lastUsed: string;
  };
  filters: {
    fileType: string;
    applicationId: string;
    applicationProjectId: string;
    status: string;
    q: string;
  };
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  rows: ImportTemplateRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolveImportTemplateFilters(params: SearchParams): ImportTemplatesData["filters"] {
  return {
    fileType: one(params, "fileType"),
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    status: one(params, "status"),
    q: one(params, "q").trim().toLowerCase(),
  };
}

const baseDriverColumns: ImportColumn[] = [
  {
    key: "driverCode",
    displayName: "Driver Code",
    required: true,
    dataType: "string",
    aliases: ["driver_code", "internalCode", "كود", "كود المندوب", "Driver Code"],
  },
  {
    key: "nationalId",
    displayName: "Iqama ID",
    required: true,
    dataType: "string",
    aliases: ["national_id", "id", "iqama", "رقم الهوية", "رقم الإقامة", "Iqama ID"],
  },
  {
    key: "actualName",
    displayName: "Arabic Driver Name (HR Approved)",
    required: true,
    dataType: "string",
    aliases: ["name", "driverName", "اسم", "اسم المندوب", "Arabic Driver Name (HR Approved)"],
  },
];

const driverMasterTemplateOptionalColumns: ImportColumn[] = [
  { key: "city", displayName: "City", dataType: "string", aliases: ["city", "المدينة", "City"] },
  { key: "project", displayName: "Current Project", dataType: "string", aliases: ["project", "المشروع", "Current Project"] },
  { key: "applicationName", displayName: "Primary App Name", dataType: "string", aliases: ["application", "appName", "التطبيق", "Primary App Name"] },
  { key: "contractType", displayName: "Relationship Type", dataType: "string", aliases: ["contract", "نوع العقد", "Relationship Type"] },
  { key: "nationality", displayName: "Nationality", dataType: "string", aliases: ["الجنسية", "Nationality"] },
  { key: "profession", displayName: "Profession", dataType: "string", aliases: ["المهنة", "Profession"] },
  { key: "passportNumber", displayName: "Passport Number", dataType: "string", aliases: ["رقم الجواز", "Passport Number"] },
  { key: "passportExpiry", displayName: "Passport Expiry", dataType: "date", aliases: ["انتهاء الجواز", "Passport Expiry"] },
  { key: "iqamaExpiry", displayName: "Iqama Expiry", dataType: "date", aliases: ["انتهاء الإقامة", "Iqama Expiry"] },
  { key: "birthDate", displayName: "Birth Date", dataType: "date", aliases: ["تاريخ الميلاد", "Birth Date"] },
  { key: "employerId", displayName: "Employer ID", dataType: "string", aliases: ["رقم صاحب العمل", "Employer ID"] },
  { key: "accommodationType", displayName: "Housing Type", dataType: "string", aliases: ["السكن", "نوع السكن", "Housing Type"] },
  { key: "vehicleOwnership", displayName: "Vehicle Ownership", dataType: "string", aliases: ["ملكية السيارة", "Vehicle Ownership"] },
  { key: "appUserId", displayName: "App Courier ID", dataType: "string", aliases: ["App Courier ID", "appUserId", "courierId"] },
  { key: "appUsername", displayName: "app Account Name English", dataType: "string", aliases: ["app Account Name English", "appUsername", "username"] },
  { key: "appStatus", displayName: "Driver App Status", dataType: "string", aliases: ["Driver App Status", "appStatus", "status"] },
  { key: "mobile", displayName: "Login Phone", dataType: "string", aliases: ["phone", "mobile", "الجوال", "Login Phone"] },
  { key: "notes", displayName: "Notes", dataType: "string", aliases: ["ملاحظات", "Notes"] },
  { key: "inHrResources", displayName: "In HR Resources", dataType: "boolean", aliases: ["In HR Resources", "inHrResources"] },
];

const commonPerformanceColumns: ImportColumn[] = [
  { key: "orders", displayName: "الطلبات", required: true, dataType: "number", aliases: ["orders", "completed_orders", "طلبات"] },
  { key: "workingHours", displayName: "ساعات العمل", required: false, dataType: "number", aliases: ["working_hours", "hours", "ساعات العمل"] },
  { key: "onTimeRate", displayName: "On Time %", required: false, dataType: "number", aliases: ["on_time", "ontime", "onTime"] },
  { key: "cancellationRate", displayName: "Cancellation %", required: false, dataType: "number", aliases: ["cancellation", "cancel"] },
  { key: "rejectionRate", displayName: "Rejection %", required: false, dataType: "number", aliases: ["rejection", "reject"] },
];

const moneyColumns: ImportColumn[] = [
  { key: "amount", displayName: "المبلغ", required: true, dataType: "number", aliases: ["amount", "value", "مبلغ"] },
  { key: "date", displayName: "التاريخ", required: true, dataType: "date", aliases: ["date", "createdAt", "تاريخ"] },
];

const keetaDailyReportRequiredColumns: ImportColumn[] = [
  { key: "reportDate", displayName: "Date", required: true, dataType: "date", aliases: [" Date", "Date", "date"] },
  { key: "appUserId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "courier_id", "courierId", "userId"] },
  { key: "orders", displayName: "Task Volumes_Delivered Tasks", required: true, dataType: "number", aliases: ["Task Volumes_Delivered Tasks", "Delivered Tasks", "orders"] },
];

const keetaDailyReportOptionalColumns: ImportColumn[] = [
  { key: "courierFirstName", displayName: "Courier First Name", dataType: "string", aliases: ["Courier First Name", "firstName"] },
  { key: "courierLastName", displayName: "Courier Last Name", dataType: "string", aliases: ["Courier Last Name", "lastName"] },
  { key: "supervisorName", displayName: "Supervisor", dataType: "string", aliases: ["Supervisor", "supervisor"] },
  { key: "vehicleType", displayName: "Vehicle Type", dataType: "string", aliases: ["Vehicle Type", "vehicleType"] },
  { key: "attendanceSummary", displayName: "Shift_Attendance Summary", dataType: "string", aliases: ["Shift_Attendance Summary"] },
  { key: "onShift", displayName: "Shift_On-Shift?", dataType: "string", aliases: ["Shift_On-Shift?", "onShift"] },
  { key: "validDay", displayName: "Shift_Valid Day?", dataType: "string", aliases: ["Shift_Valid Day?", "validDay"] },
  { key: "courierAppOnlineTime", displayName: "Shift_Courier App Online Time", dataType: "string", aliases: ["Shift_Courier App Online Time"] },
  { key: "workingHours", displayName: "Shift_Valid Online Time", dataType: "string", aliases: ["Shift_Valid Online Time", "workingHours"] },
  { key: "peakOnlineHours", displayName: "Shift_Peak Online Hours", dataType: "string", aliases: ["Shift_Peak Online Hours"] },
  { key: "acceptedTasks", displayName: "Task Volumes_Accepted Tasks", dataType: "number", aliases: ["Task Volumes_Accepted Tasks"] },
  { key: "restaurantArrivalTasks", displayName: "Task Volumes_Tasks with restaurant arrivals", dataType: "number", aliases: ["Task Volumes_Tasks with restaurant arrivals"] },
  { key: "largeOrderTasksCompleted", displayName: "Task Volumes_Large Order Tasks Completed", dataType: "number", aliases: ["Task Volumes_Large Order Tasks Completed"] },
  { key: "rejectionRate", displayName: "Task Volumes_Rejected Tasks", dataType: "number", aliases: ["Task Volumes_Rejected Tasks", "rejection"] },
  { key: "rejectedTasksCourier", displayName: "Task Volumes_Rejected Tasks (Courier)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Courier)"] },
  { key: "rejectedTasksAuto", displayName: "Task Volumes_Rejected Tasks (Auto)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Auto)"] },
  { key: "cancellationRate", displayName: "Task Volumes_Cancellation Rate from Delivery Issues", dataType: "number", aliases: ["Task Volumes_Cancellation Rate from Delivery Issues", "cancellation"] },
  { key: "completionRate", displayName: "Task Volumes_Order completion rate (non-delivery related)", dataType: "number", aliases: ["Task Volumes_Order completion rate (non-delivery related)"] },
  { key: "onTimeRate", displayName: "Delivery Experience_On-time Rate (D)", dataType: "number", aliases: ["Delivery Experience_On-time Rate (D)", "onTimeRate", "on_time"] },
  { key: "largeOrderOnTimeRate", displayName: "Delivery Experience_Large order on-time rate", dataType: "number", aliases: ["Delivery Experience_Large order on-time rate"] },
  { key: "averageDeliveryTime", displayName: "Delivery Experience_Avg Delivery Time of Delivered Orders", dataType: "string", aliases: ["Delivery Experience_Avg Delivery Time of Delivered Orders"] },
  { key: "deliveredOver55minRate", displayName: "Delivery Experience_Delivered Orders Prop. (Over 55min)", dataType: "number", aliases: ["Delivery Experience_Delivered Orders Prop. (Over 55min)"] },
  { key: "overdueOrderTasks", displayName: "Delivery Experience_Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Overdue Order Tasks"] },
  { key: "severelyOverdueOrderTasks", displayName: "Delivery Experience_Severely Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Severely Overdue Order Tasks"] },
];

function mappingFor(columns: ImportColumn[]): ImportColumnMapping[] {
  return columns.map((column) => ({
    incomingColumn: column.displayName,
    systemField: column.key,
    required: Boolean(column.required),
    transformRule: column.dataType,
  }));
}

function definition(
  fileType: string,
  name: string,
  category: ImportTemplateDefinition["category"],
  requiredColumns: ImportColumn[],
  optionalColumns: ImportColumn[],
  extra?: Partial<ImportTemplateDefinition>,
): ImportTemplateDefinition {
  return {
    fileType,
    name,
    category,
    requiredColumns,
    optionalColumns,
    columnMapping: mappingFor([...requiredColumns, ...optionalColumns]),
    matchingFields: ["driverCode", "nationalId", "appUserId", "appUsername", "mobile"],
    uniqueKeys: requiredColumns.slice(0, 1).map((column) => column.key),
    ...extra,
  };
}

export const importTemplateDefinitions: ImportTemplateDefinition[] = [
  definition("drivers", "Drivers Master Template", "drivers", baseDriverColumns, driverMasterTemplateOptionalColumns, {
    matchingFields: ["driverCode", "nationalId", "appUserId", "appUsername", "mobile"],
    uniqueKeys: ["driverCode", "nationalId"],
  }),
  definition("vehicles", "Vehicles Template", "vehicles", [
    { key: "plateEnglish", displayName: "اللوحة إنجليزي", required: true, dataType: "string", aliases: ["plateEn", "plate_english"] },
  ], [
    { key: "vehicleCode", displayName: "كود السيارة", dataType: "string", aliases: ["vehicleCode", "vehicle_code"] },
    { key: "plateArabic", displayName: "اللوحة عربي", dataType: "string", aliases: ["plateAr", "plate_arabic"] },
    { key: "brand", displayName: "الماركة", dataType: "string", aliases: ["brand"] },
    { key: "model", displayName: "الموديل", dataType: "string", aliases: ["model"] },
    { key: "monthlyRent", displayName: "الإيجار الشهري", dataType: "number", aliases: ["monthlyRent", "rent"] },
    { key: "assignedDriverCode", displayName: "كود المندوب الحالي", dataType: "string", aliases: ["driverCode"] },
  ], { matchingFields: ["vehicleCode", "plateArabic", "plateEnglish"], uniqueKeys: ["plateEnglish"] }),
  definition("application_accounts", "Application Accounts Template", "applications", [
    { key: "appUserId", displayName: "معرف الحساب", required: true, dataType: "string", aliases: ["appUserId", "accountId", "user_id"] },
  ], [
    { key: "appUsername", displayName: "اسم مستخدم التطبيق", dataType: "string", aliases: ["username", "appUsername"] },
    { key: "applicationName", displayName: "التطبيق", dataType: "string", aliases: ["application", "appName"] },
    { key: "driverCode", displayName: "كود المندوب", dataType: "string", aliases: ["driverCode"] },
    { key: "nationalId", displayName: "رقم الهوية", dataType: "string", aliases: ["nationalId"] },
  ], { uniqueKeys: ["appUserId"], matchingFields: ["appUserId", "appUsername", "driverCode", "nationalId"] }),
  definition("keeta_invoice", "Keeta Daily Report Template", "applications", keetaDailyReportRequiredColumns, keetaDailyReportOptionalColumns, {
    applicationCode: "KEETA",
    uniqueKeys: ["reportDate", "appUserId"],
    matchingFields: ["appUserId", "appUsername", "driverCode", "nationalId"],
  }),
  definition("keeta_rank", "Keeta Rank Template", "applications", [
    { key: "appUserId", displayName: "معرف حساب Keeta", required: true, dataType: "string", aliases: ["appUserId", "userId"] },
    { key: "rank", displayName: "Rank", required: true, dataType: "string", aliases: ["rank", "level"] },
  ], [
    ...baseDriverColumns,
    ...commonPerformanceColumns,
    { key: "reportDate", displayName: "تاريخ الرانك", dataType: "date", aliases: ["date", "rankDate"] },
  ], { applicationCode: "KEETA", uniqueKeys: ["appUserId"] }),
  definition("hungerstation_invoice", "HungerStation Invoice Template", "applications", [...baseDriverColumns.slice(0, 1), ...commonPerformanceColumns.slice(0, 1)], [
    ...commonPerformanceColumns.slice(1),
    { key: "collectionAmount", displayName: "التحصيل", dataType: "number", aliases: ["collection", "revenue"] },
    { key: "appUserId", displayName: "معرف حساب HungerStation", dataType: "string", aliases: ["appUserId"] },
  ], { applicationCode: "HUNGERSTATION" }),
  definition("hungerstation_performance", "HungerStation Performance Template", "applications", [...baseDriverColumns.slice(0, 1), ...commonPerformanceColumns], [
    { key: "acceptanceRate", displayName: "Acceptance %", dataType: "number", aliases: ["acceptance"] },
    { key: "reportDate", displayName: "تاريخ التقرير", dataType: "date", aliases: ["date"] },
  ], { applicationCode: "HUNGERSTATION" }),
  definition("talabat_invoice", "Talabat Invoice Template", "applications", [...baseDriverColumns.slice(0, 1), ...commonPerformanceColumns.slice(0, 1)], [
    ...commonPerformanceColumns.slice(1),
    { key: "collectionAmount", displayName: "التحصيل", dataType: "number", aliases: ["collection"] },
    { key: "appUserId", displayName: "معرف حساب Talabat", dataType: "string", aliases: ["appUserId"] },
  ], { applicationCode: "TALABAT" }),
  definition("advances", "Advances Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "reason", displayName: "السبب", dataType: "string", aliases: ["reason"] },
    { key: "deductionMonth", displayName: "شهر الخصم", dataType: "string", aliases: ["deductionMonth"] },
  ]),
  definition("deductions", "Deductions Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "type", displayName: "نوع الخصم", dataType: "string", aliases: ["type"] },
    { key: "notes", displayName: "ملاحظات", dataType: "string", aliases: ["notes"] },
  ]),
  definition("violations", "Violations Template", "operations", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "type", displayName: "نوع المخالفة", dataType: "string", aliases: ["type"] },
    { key: "vehiclePlate", displayName: "لوحة السيارة", dataType: "string", aliases: ["plate", "vehiclePlate"] },
  ]),
  definition("fuel", "Fuel Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "liters", displayName: "اللترات", dataType: "number", aliases: ["liters"] },
    { key: "vehiclePlate", displayName: "لوحة السيارة", dataType: "string", aliases: ["plate"] },
  ]),
  definition("hr_documents", "HR Documents Template", "hr", [...baseDriverColumns.slice(0, 2), {
    key: "documentType",
    displayName: "نوع المستند",
    required: true,
    dataType: "string",
    aliases: ["documentType"],
  }], [
    { key: "documentNumber", displayName: "رقم المستند", dataType: "string", aliases: ["documentNumber"] },
    { key: "expiryDate", displayName: "تاريخ الانتهاء", dataType: "date", aliases: ["expiryDate"] },
  ]),
  definition("payroll", "Payroll Template", "payroll", [...baseDriverColumns.slice(0, 2), {
    key: "month",
    displayName: "الشهر",
    required: true,
    dataType: "string",
    aliases: ["month"],
  }, {
    key: "year",
    displayName: "السنة",
    required: true,
    dataType: "number",
    aliases: ["year"],
  }], [
    { key: "basicSalary", displayName: "الراتب الأساسي", dataType: "number", aliases: ["basicSalary"] },
    { key: "bonus", displayName: "البونص", dataType: "number", aliases: ["bonus"] },
    { key: "deductions", displayName: "الخصومات", dataType: "number", aliases: ["deductions"] },
    { key: "netSalary", displayName: "صافي الراتب", dataType: "number", aliases: ["netSalary"] },
  ]),
];

export function getBuiltinTemplate(fileType: string) {
  return importTemplateDefinitions.find((item) => item.fileType === fileType);
}

export function jsonInput(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function countJson(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

export function statusText(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "نشط";
  if (value === "INACTIVE") return "غير نشط";
  if (value === "PENDING") return "قيد المراجعة";
  if (value === "APPROVED") return "معتمد";
  if (value === "REJECTED") return "مرفوض";
  if (value === "LOCKED") return "مغلق";
  if (value === "PREVIEW") return "معاينة";
  if (value === "COMMITTED") return "محفوظ";
  if (value === "COMMITTED_PENDING_PROCESSING") return "محفوظ بانتظار المعالجة";
  if (value === "CANCELLED" || value === "CANCELED") return "ملغي";
  return String(status ?? "-");
}

export function statusValue(value: unknown): "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED" {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  if (raw === "INACTIVE" || raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED" || raw === "LOCKED") return raw;
  return "ACTIVE";
}

export function formatDate(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

export function databaseOfflineMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "P1001" || code === "P1002" || message.includes("Can't reach database server") || message.includes("ECONNREFUSED")) {
    return "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.";
  }
  return "";
}

export function templateFromDefinition(definitionItem: ImportTemplateDefinition): ImportTemplateRow {
  return {
    id: `builtin:${definitionItem.fileType}`,
    source: "builtin",
    name: definitionItem.name,
    fileType: definitionItem.fileType,
    category: definitionItem.category,
    applicationId: "",
    applicationName: definitionItem.applicationCode ?? "-",
    applicationProjectId: "",
    projectName: "كل المشاريع",
    requiredColumnsCount: definitionItem.requiredColumns.length,
    optionalColumnsCount: definitionItem.optionalColumns.length,
    mappingStatus: "جاهز",
    lastUsedAt: "-",
    status: "نشط",
    requiredColumns: definitionItem.requiredColumns,
    optionalColumns: definitionItem.optionalColumns,
    columnMapping: definitionItem.columnMapping,
  };
}

function rowFromDatabaseTemplate(template: {
  id: string;
  name: string;
  fileType: string;
  requiredColumns: unknown;
  optionalColumns: unknown;
  columnMapping: unknown;
  lastUsedAt: Date | null;
  status: unknown;
  applicationId: string | null;
  applicationProjectId: string | null;
  application?: { id: string; code: string; name: string } | null;
  applicationProject?: { id: string; code: string; name: string } | null;
}): ImportTemplateRow {
  const definitionItem = getBuiltinTemplate(template.fileType);
  const requiredColumns = parseJsonArray<ImportColumn>(template.requiredColumns, definitionItem?.requiredColumns ?? []);
  const optionalColumns = parseJsonArray<ImportColumn>(template.optionalColumns, definitionItem?.optionalColumns ?? []);
  const columnMapping = parseJsonArray<ImportColumnMapping>(template.columnMapping, definitionItem?.columnMapping ?? []);

  return {
    id: template.id,
    source: "database",
    name: template.name,
    fileType: template.fileType,
    category: definitionItem?.category ?? "operations",
    applicationId: template.applicationId ?? "",
    applicationName: template.application?.name ?? definitionItem?.applicationCode ?? "-",
    applicationProjectId: template.applicationProjectId ?? "",
    projectName: template.applicationProject?.name ?? "كل المشاريع",
    requiredColumnsCount: requiredColumns.length,
    optionalColumnsCount: optionalColumns.length,
    mappingStatus: columnMapping.length ? "مكتمل" : "يحتاج Mapping",
    lastUsedAt: formatDate(template.lastUsedAt),
    status: statusText(template.status),
    requiredColumns,
    optionalColumns,
    columnMapping,
  };
}

function emptyData(filters: ImportTemplatesData["filters"], message?: string): ImportTemplatesData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: {
      total: 0,
      active: 0,
      applicationTemplates: 0,
      driverTemplates: 0,
      vehicleTemplates: 0,
      financeTemplates: 0,
      needsMapping: 0,
      lastUsed: "-",
    },
    applications: [],
    projects: [],
    rows: importTemplateDefinitions.map(templateFromDefinition),
  };
}

export async function getImportTemplatesData(filters: ImportTemplatesData["filters"]): Promise<ImportTemplatesData> {
  try {
    const [templates, applications, projects] = await Promise.all([
      prisma.applicationImportTemplate.findMany({
        include: {
          application: { select: { id: true, code: true, name: true } },
          applicationProject: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      }),
      prisma.application.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
      prisma.applicationProject.findMany({ select: { id: true, code: true, name: true, applicationId: true }, orderBy: { name: "asc" } }),
    ]);

    const databaseRows = templates.map(rowFromDatabaseTemplate);
    const databaseFileTypes = new Set(databaseRows.map((row) => row.fileType));
    const builtinRows = importTemplateDefinitions.filter((item) => !databaseFileTypes.has(item.fileType)).map(templateFromDefinition);
    let rows = [...databaseRows, ...builtinRows];

    if (filters.fileType) rows = rows.filter((row) => row.fileType === filters.fileType);
    if (filters.applicationId) rows = rows.filter((row) => row.applicationId === filters.applicationId);
    if (filters.applicationProjectId) rows = rows.filter((row) => row.applicationProjectId === filters.applicationProjectId);
    if (filters.status) rows = rows.filter((row) => row.status === statusText(filters.status) || row.status.toLowerCase() === filters.status.toLowerCase());
    if (filters.q) rows = rows.filter((row) => `${row.name} ${row.fileType} ${row.applicationName} ${row.projectName}`.toLowerCase().includes(filters.q));

    const lastUsedDates = databaseRows
      .map((row) => (row.lastUsedAt === "-" ? 0 : new Date(row.lastUsedAt).getTime()))
      .filter(Boolean);

    return {
      databaseStatus: "online",
      filters,
      applications,
      projects,
      rows,
      summary: {
        total: rows.length,
        active: rows.filter((row) => row.status === "نشط").length,
        applicationTemplates: rows.filter((row) => row.category === "applications").length,
        driverTemplates: rows.filter((row) => row.category === "drivers").length,
        vehicleTemplates: rows.filter((row) => row.category === "vehicles").length,
        financeTemplates: rows.filter((row) => row.category === "finance" || row.category === "payroll").length,
        needsMapping: rows.filter((row) => row.mappingStatus !== "مكتمل" && row.mappingStatus !== "جاهز").length,
        lastUsed: lastUsedDates.length ? formatDate(new Date(Math.max(...lastUsedDates))) : "-",
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}

export async function resolveTemplateForUse(templateId: string | null, fileType: string) {
  if (templateId?.startsWith("builtin:")) {
    const type = templateId.replace("builtin:", "");
    const definitionItem = getBuiltinTemplate(type);
    if (!definitionItem) throw new Error("القالب غير موجود.");
    return {
      id: templateId,
      source: "builtin" as const,
      name: definitionItem.name,
      fileType: definitionItem.fileType,
      requiredColumns: definitionItem.requiredColumns,
      optionalColumns: definitionItem.optionalColumns,
      columnMapping: definitionItem.columnMapping,
    };
  }

  if (templateId) {
    const template = await prisma.applicationImportTemplate.findUnique({ where: { id: templateId } });
    if (template) {
      const definitionItem = getBuiltinTemplate(template.fileType);
      return {
        id: template.id,
        source: "database" as const,
        name: template.name,
        fileType: template.fileType,
        requiredColumns: parseJsonArray<ImportColumn>(template.requiredColumns, definitionItem?.requiredColumns ?? []),
        optionalColumns: parseJsonArray<ImportColumn>(template.optionalColumns, definitionItem?.optionalColumns ?? []),
        columnMapping: parseJsonArray<ImportColumnMapping>(template.columnMapping, definitionItem?.columnMapping ?? []),
      };
    }
  }

  const definitionItem = getBuiltinTemplate(fileType);
  if (!definitionItem) throw new Error("نوع الاستيراد غير مدعوم.");
  return {
    id: `builtin:${definitionItem.fileType}`,
    source: "builtin" as const,
    name: definitionItem.name,
    fileType: definitionItem.fileType,
    requiredColumns: definitionItem.requiredColumns,
    optionalColumns: definitionItem.optionalColumns,
    columnMapping: definitionItem.columnMapping,
  };
}
