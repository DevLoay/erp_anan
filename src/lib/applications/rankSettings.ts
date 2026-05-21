import { prisma } from "@/lib/prisma";
import { formatDate, normalizeAppKey } from "./applicationAnalytics";
import type { ApplicationOption, ApplicationProjectOption } from "./invoiceSettings";

export type RankSettingFilters = {
  applicationId: string;
  applicationProjectId: string;
  rankType: string;
  status: string;
  q: string;
};

export type RankSettingRow = {
  id: string;
  name: string;
  applicationId: string;
  applicationName: string;
  applicationCode: string;
  applicationProjectId: string;
  projectName: string;
  rankType: string;
  minimumOrders: number | null;
  onTimeRule: string;
  cancellationRule: string;
  rejectionRule: string;
  workingHoursRule: string;
  levelOutput: string;
  status: string;
  updatedAt: string;
  onTimeRuleRaw: unknown;
  cancellationRuleRaw: unknown;
  rejectionRuleRaw: unknown;
  workingHoursRuleRaw: unknown;
  bonusRule: unknown;
  deductionRule: unknown;
  levelOutputRaw: unknown;
};

export type RankSettingsData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: RankSettingFilters;
  summary: {
    total: number;
    keeta: number;
    hungerstation: number;
    talabat: number;
    active: number;
    needsReview: number;
  };
  applications: ApplicationOption[];
  projects: ApplicationProjectOption[];
  rankTypes: string[];
  rows: RankSettingRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolveRankSettingFilters(params: SearchParams): RankSettingFilters {
  return {
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    rankType: one(params, "rankType"),
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

function ruleSummary(value: unknown) {
  const count = countJson(value);
  if (!count) return "-";
  if (Array.isArray(value)) return `${count} قاعدة`;
  if (value && typeof value === "object") {
    const values = Object.entries(value as Record<string, unknown>)
      .slice(0, 2)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join(" / ");
    return values || `${count} قاعدة`;
  }
  return String(value);
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

function emptyData(filters: RankSettingFilters, message?: string): RankSettingsData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: { total: 0, keeta: 0, hungerstation: 0, talabat: 0, active: 0, needsReview: 0 },
    applications: [],
    projects: [],
    rankTypes: [],
    rows: [],
  };
}

export async function getRankSettingsData(filters: RankSettingFilters): Promise<RankSettingsData> {
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
      prisma.applicationRankSetting.findMany({
        select: {
          id: true,
          name: true,
          rankType: true,
          minimumOrders: true,
          onTimeRule: true,
          cancellationRule: true,
          rejectionRule: true,
          workingHoursRule: true,
          bonusRule: true,
          deductionRule: true,
          levelOutput: true,
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
      const needsReview =
        !row.minimumOrders ||
        !countJson(row.onTimeRule) ||
        !countJson(row.cancellationRule) ||
        !countJson(row.rejectionRule) ||
        !countJson(row.workingHoursRule) ||
        !countJson(row.levelOutput);
      return {
        id: row.id,
        name: row.name,
        applicationId: row.applicationId,
        applicationName: row.application.name,
        applicationCode: row.application.code,
        applicationProjectId: row.applicationProjectId ?? "",
        projectName: row.applicationProject?.name ?? "كل المشاريع",
        rankType: row.rankType ?? "-",
        minimumOrders: row.minimumOrders,
        onTimeRule: ruleSummary(row.onTimeRule),
        cancellationRule: ruleSummary(row.cancellationRule),
        rejectionRule: ruleSummary(row.rejectionRule),
        workingHoursRule: ruleSummary(row.workingHoursRule),
        levelOutput: needsReview ? "تحتاج مراجعة" : ruleSummary(row.levelOutput),
        status: statusText(row.status),
        updatedAt: formatDate(row.updatedAt),
        onTimeRuleRaw: row.onTimeRule,
        cancellationRuleRaw: row.cancellationRule,
        rejectionRuleRaw: row.rejectionRule,
        workingHoursRuleRaw: row.workingHoursRule,
        bonusRule: row.bonusRule,
        deductionRule: row.deductionRule,
        levelOutputRaw: row.levelOutput,
      };
    });

    const filteredRows = rows.filter((row) => {
      if (filters.applicationId && row.applicationId !== filters.applicationId) return false;
      if (filters.applicationProjectId && row.applicationProjectId !== filters.applicationProjectId) return false;
      if (filters.rankType && row.rankType !== filters.rankType) return false;
      if (filters.status && row.status !== statusText(filters.status)) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const haystack = [row.name, row.applicationName, row.applicationCode, row.projectName, row.rankType].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const summary = {
      total: rows.length,
      keeta: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "keeta").length,
      hungerstation: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "hungerstation").length,
      talabat: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "talabat").length,
      active: rows.filter((row) => row.status === "نشط").length,
      needsReview: rows.filter((row) => row.levelOutput === "تحتاج مراجعة").length,
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
      rankTypes: Array.from(new Set(rows.map((row) => row.rankType).filter((value) => value && value !== "-"))).sort(),
      rows: filteredRows,
    };
  } catch (error) {
    if (isDatabaseOffline(error)) {
      return emptyData(filters, "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.");
    }
    throw error;
  }
}
