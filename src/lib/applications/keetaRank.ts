import { prisma } from "@/lib/prisma";
import { formatDate, normalizeAppKey } from "./applicationAnalytics";

export type KeetaRankFilters = {
  applicationProjectId: string;
  cityId: string;
  importDate: string;
  status: string;
  rankLevel: string;
  q: string;
};

export type KeetaRankHistoryRow = {
  id: string;
  fileName: string;
  projectName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  duplicateRows: number;
  status: string;
  createdAt: string;
};

export type KeetaRankTableRow = {
  id: string;
  importDate: string;
  projectName: string;
  cityName: string;
  driverCode: string;
  driverName: string;
  nationalId: string;
  appUserId: string;
  appUsername: string;
  rank: string;
  orders: string;
  onTime: string;
  cancellation: string;
  rejection: string;
  workingHours: string;
  matchStatus: string;
  errorMessage: string;
};

export type KeetaRankData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  keetaApplication: { id: string; name: string; code: string } | null;
  filters: KeetaRankFilters;
  summary: {
    importedFiles: number;
    lastImport: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    missingDrivers: number;
    unlinkedAccounts: number;
    duplicateRows: number;
    linkedDrivers: number;
  };
  projects: { id: string; name: string; cityName: string }[];
  cities: { id: string; name: string }[];
  rankSettings: { id: string; name: string; projectName: string }[];
  history: KeetaRankHistoryRow[];
  rows: KeetaRankTableRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolveKeetaRankFilters(params: SearchParams): KeetaRankFilters {
  return {
    applicationProjectId: one(params, "applicationProjectId"),
    cityId: one(params, "cityId"),
    importDate: one(params, "importDate"),
    status: one(params, "status"),
    rankLevel: one(params, "rankLevel"),
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

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function cityName(city?: { nameAr: string | null; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "غير محدد";
}

function emptyData(filters: KeetaRankFilters, message?: string): KeetaRankData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    keetaApplication: null,
    filters,
    summary: {
      importedFiles: 0,
      lastImport: "-",
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      missingDrivers: 0,
      unlinkedAccounts: 0,
      duplicateRows: 0,
      linkedDrivers: 0,
    },
    projects: [],
    cities: [],
    rankSettings: [],
    history: [],
    rows: [],
  };
}

export async function getKeetaRankData(filters: KeetaRankFilters): Promise<KeetaRankData> {
  try {
    const applications = await prisma.application.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
    const applicationRecord = applications.find((app) => normalizeAppKey(`${app.code} ${app.name}`) === "keeta") ?? null;
    const legacyKeetaCount = applicationRecord
      ? 0
      : await prisma.applicationAccount.count({ where: { appName: "Keeta" } });
    const keetaApplication = applicationRecord ?? (legacyKeetaCount ? { id: "", code: "KEETA", name: "Keeta" } : null);

    if (!keetaApplication) {
      return {
        ...emptyData(filters),
        keetaApplication: null,
      };
    }

    const [projects, cities, rankSettings, history, importedRows] = await Promise.all([
      prisma.applicationProject.findMany({
        where: { applicationId: keetaApplication.id || "__missing_keeta_application__" },
        select: { id: true, name: true, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
      prisma.applicationRankSetting.findMany({
        where: { applicationId: keetaApplication.id || "__missing_keeta_application__" },
        select: { id: true, name: true, applicationProject: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.applicationImportBatch.findMany({
        where: {
          fileType: "KEETA_RANK",
          ...(keetaApplication.id ? { OR: [{ applicationId: keetaApplication.id }, { applicationId: null }] } : {}),
          ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
        },
        include: { applicationProject: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.applicationImportRow.findMany({
        where: {
          batch: {
            fileType: "KEETA_RANK",
            ...(keetaApplication.id ? { OR: [{ applicationId: keetaApplication.id }, { applicationId: null }] } : {}),
            ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
            ...(filters.importDate ? { createdAt: { gte: new Date(`${filters.importDate}T00:00:00.000Z`), lt: new Date(`${filters.importDate}T23:59:59.999Z`) } } : {}),
          },
          ...(filters.status ? { status: filters.status } : {}),
        },
        include: {
          batch: { include: { applicationProject: { include: { city: { select: { nameAr: true, nameEn: true } } } } } },
          driver: { select: { internalCode: true, driverCode: true, name: true, nationalId: true, cityId: true, city: { select: { nameAr: true, nameEn: true } } } },
          applicationAccount: { select: { appUserId: true, appUsername: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);

    const historyRows = history.map((row) => ({
      id: row.id,
      fileName: row.fileName ?? "-",
      projectName: row.applicationProject?.name ?? "كل المشاريع",
      totalRows: row.totalRows,
      validRows: row.validRows,
      invalidRows: row.invalidRows,
      missingDrivers: row.missingDrivers,
      unlinkedAccounts: row.unlinkedAccounts,
      duplicateRows: row.duplicateRows,
      status: row.status,
      createdAt: formatDate(row.createdAt),
    }));

    const tableRows = importedRows.map((row) => {
      const mapped = jsonObject(row.mappedData);
      return {
        id: row.id,
        importDate: formatDate(row.createdAt),
        projectName: row.batch.applicationProject?.name ?? "كل المشاريع",
        cityName: cityName(row.driver?.city ?? row.batch.applicationProject?.city),
        driverCode: text(mapped.driverCode ?? row.driver?.driverCode ?? row.driver?.internalCode),
        driverName: text(mapped.driverName ?? row.driver?.name),
        nationalId: text(mapped.nationalId ?? row.driver?.nationalId),
        appUserId: text(mapped.appUserId ?? row.applicationAccount?.appUserId),
        appUsername: text(mapped.appUsername ?? row.applicationAccount?.appUsername ?? row.applicationAccount?.username),
        rank: text(mapped.rank),
        orders: text(mapped.orders),
        onTime: text(mapped.onTime),
        cancellation: text(mapped.cancellation),
        rejection: text(mapped.rejection),
        workingHours: text(mapped.workingHours),
        matchStatus: row.status,
        errorMessage: row.errorMessage ?? "-",
      };
    }).filter((row) => {
      if (filters.rankLevel && row.rank !== filters.rankLevel) return false;
      if (filters.cityId) {
        const selectedCity = cities.find((city) => city.id === filters.cityId);
        if (selectedCity && row.cityName !== cityName(selectedCity)) return false;
      }
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const haystack = [row.driverCode, row.driverName, row.nationalId, row.appUserId, row.appUsername, row.rank].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const summary = {
      importedFiles: historyRows.length,
      lastImport: historyRows[0]?.createdAt ?? "-",
      totalRows: historyRows.reduce((sum, row) => sum + row.totalRows, 0),
      validRows: historyRows.reduce((sum, row) => sum + row.validRows, 0),
      invalidRows: historyRows.reduce((sum, row) => sum + row.invalidRows, 0),
      missingDrivers: historyRows.reduce((sum, row) => sum + row.missingDrivers, 0),
      unlinkedAccounts: historyRows.reduce((sum, row) => sum + row.unlinkedAccounts, 0),
      duplicateRows: historyRows.reduce((sum, row) => sum + row.duplicateRows, 0),
      linkedDrivers: tableRows.filter((row) => row.matchStatus === "Valid").length,
    };

    return {
      databaseStatus: "online",
      keetaApplication,
      filters,
      summary,
      projects: projects.map((project) => ({ id: project.id, name: project.name, cityName: cityName(project.city) })),
      cities: cities.map((city) => ({ id: city.id, name: cityName(city) })),
      rankSettings: rankSettings.map((setting) => ({ id: setting.id, name: setting.name, projectName: setting.applicationProject?.name ?? "كل المشاريع" })),
      history: historyRows,
      rows: tableRows,
    };
  } catch (error) {
    if (isDatabaseOffline(error)) {
      return emptyData(filters, "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.");
    }
    throw error;
  }
}
