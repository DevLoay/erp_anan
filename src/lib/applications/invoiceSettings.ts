import { prisma } from "@/lib/prisma";
import { formatDate, normalizeAppKey } from "./applicationAnalytics";

export type ApplicationOption = {
  id: string;
  code: string;
  name: string;
};

export type ApplicationProjectOption = {
  id: string;
  code: string;
  name: string;
  applicationId: string;
  applicationName: string;
};

export type InvoiceSettingFilters = {
  applicationId: string;
  applicationProjectId: string;
  invoiceType: string;
  status: string;
  q: string;
};

export type InvoiceSettingRow = {
  id: string;
  name: string;
  applicationId: string;
  applicationName: string;
  applicationCode: string;
  applicationProjectId: string;
  projectName: string;
  invoiceType: string;
  requiredColumnsCount: number;
  optionalColumnsCount: number;
  mappingStatus: string;
  rulesStatus: string;
  status: string;
  updatedAt: string;
  requiredColumns: unknown;
  optionalColumns: unknown;
  columnMapping: unknown;
  calculationRules: unknown;
  deductionRules: unknown;
  bonusRules: unknown;
};

export type InvoiceSettingsData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: InvoiceSettingFilters;
  summary: {
    total: number;
    active: number;
    keeta: number;
    hungerstation: number;
    talabat: number;
    withoutProject: number;
    needsReview: number;
  };
  applications: ApplicationOption[];
  projects: ApplicationProjectOption[];
  invoiceTypes: string[];
  rows: InvoiceSettingRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolveInvoiceSettingFilters(params: SearchParams): InvoiceSettingFilters {
  return {
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    invoiceType: one(params, "invoiceType"),
    status: one(params, "status"),
    q: one(params, "q").trim(),
  };
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown database error";
}

function isDatabaseOffline(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server") || message.includes("ECONNREFUSED");
}

function countJson(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function hasRules(row: { calculationRules: unknown; deductionRules: unknown; bonusRules: unknown }) {
  return countJson(row.calculationRules) + countJson(row.deductionRules) + countJson(row.bonusRules) > 0;
}

function statusText(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "نشط";
  if (value === "INACTIVE") return "غير نشط";
  if (value === "PENDING") return "قيد المراجعة";
  if (value === "APPROVED") return "معتمد";
  if (value === "REJECTED") return "مرفوض";
  if (value === "LOCKED") return "مغلق";
  return String(status ?? "-");
}

function emptyData(filters: InvoiceSettingFilters, message?: string): InvoiceSettingsData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: { total: 0, active: 0, keeta: 0, hungerstation: 0, talabat: 0, withoutProject: 0, needsReview: 0 },
    applications: [],
    projects: [],
    invoiceTypes: [],
    rows: [],
  };
}

export async function getInvoiceSettingsData(filters: InvoiceSettingFilters): Promise<InvoiceSettingsData> {
  try {
    const [applications, projects, settings] = await Promise.all([
      prisma.application.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.applicationProject.findMany({
        select: { id: true, code: true, name: true, applicationId: true, application: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.applicationInvoiceSetting.findMany({
        select: {
          id: true,
          name: true,
          invoiceType: true,
          requiredColumns: true,
          optionalColumns: true,
          columnMapping: true,
          calculationRules: true,
          deductionRules: true,
          bonusRules: true,
          status: true,
          updatedAt: true,
          applicationId: true,
          applicationProjectId: true,
          application: { select: { id: true, code: true, name: true } },
          applicationProject: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      }),
    ]);

    const rows = settings.map((row) => {
      const requiredColumnsCount = countJson(row.requiredColumns);
      const optionalColumnsCount = countJson(row.optionalColumns);
      const mappingCount = countJson(row.columnMapping);
      const rulesReady = hasRules(row);
      return {
        id: row.id,
        name: row.name,
        applicationId: row.applicationId,
        applicationName: row.application.name,
        applicationCode: row.application.code,
        applicationProjectId: row.applicationProjectId ?? "",
        projectName: row.applicationProject?.name ?? "كل المشاريع",
        invoiceType: row.invoiceType ?? "-",
        requiredColumnsCount,
        optionalColumnsCount,
        mappingStatus: mappingCount ? `${mappingCount} mapping` : "يحتاج Mapping",
        rulesStatus: rulesReady ? "مكتملة" : "تحتاج مراجعة",
        status: statusText(row.status),
        updatedAt: formatDate(row.updatedAt),
        requiredColumns: row.requiredColumns,
        optionalColumns: row.optionalColumns,
        columnMapping: row.columnMapping,
        calculationRules: row.calculationRules,
        deductionRules: row.deductionRules,
        bonusRules: row.bonusRules,
      };
    });

    const filteredRows = rows.filter((row) => {
      if (filters.applicationId && row.applicationId !== filters.applicationId) return false;
      if (filters.applicationProjectId && row.applicationProjectId !== filters.applicationProjectId) return false;
      if (filters.invoiceType && row.invoiceType !== filters.invoiceType) return false;
      if (filters.status && row.status !== statusText(filters.status)) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const haystack = [row.name, row.applicationName, row.applicationCode, row.projectName, row.invoiceType].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const summary = {
      total: rows.length,
      active: rows.filter((row) => row.status === "نشط").length,
      keeta: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "keeta").length,
      hungerstation: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "hungerstation").length,
      talabat: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "talabat").length,
      withoutProject: rows.filter((row) => !row.applicationProjectId).length,
      needsReview: rows.filter((row) => row.mappingStatus === "يحتاج Mapping" || row.rulesStatus === "تحتاج مراجعة").length,
    };

    return {
      databaseStatus: "online",
      filters,
      summary,
      applications,
      projects: projects.map((project) => ({
        id: project.id,
        code: project.code,
        name: project.name,
        applicationId: project.applicationId,
        applicationName: project.application.name,
      })),
      invoiceTypes: Array.from(new Set(rows.map((row) => row.invoiceType).filter((value) => value && value !== "-"))).sort(),
      rows: filteredRows,
    };
  } catch (error) {
    if (isDatabaseOffline(error)) {
      return emptyData(filters, "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.");
    }
    throw error;
  }
}
