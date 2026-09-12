import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/auth/accessScope";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { DAILY_MINIMUM_ORDERS, getDailyPerformanceStatus, type DailyPerformanceStatusCode } from "@/lib/performance/dailyPerformance";
import { displayCurrentEstimatedLevel } from "@/lib/performance/driverLevel";
import type { Prisma } from "@prisma/client";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function monthFromDate(value: string) {
  return value ? value.slice(0, 7) : "";
}

function parseCompactDate(value: unknown) {
  const raw = String(value ?? "").trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const date = new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])));
    return Number.isNaN(date.getTime()) ? "" : isoDate(date);
  }
  return isoDate(raw);
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "الشهر الحالي";
  const [year, number] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(number) - 1] ?? number} ${year}`;
}

function appDisplayName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("keeta")) return "Keeta";
  if (lower.includes("hunger")) return "HungerStation";
  if (lower.includes("talabat")) return "Talabat";
  if (lower.includes("jahez")) return "Jahez";
  if (lower.includes("ninja")) return "Ninja";
  if (lower.includes("toyou")) return "Toyou";
  return raw || "غير محدد";
}

function isKnownOperationalProject(value: string | null | undefined) {
  return ["Keeta", "HungerStation", "Talabat", "Jahez", "Ninja", "Toyou"].includes(appDisplayName(value));
}

function appWhere(value: string) {
  if (!value) return undefined;
  const display = appDisplayName(value);
  if (display === "Keeta") return { in: ["Keeta", "keeta_period_report_template", "keeta_rank_template", "keeta_driver_invoice_template", "keeta_invoice", "keeta_rank"] };
  if (display === "HungerStation") return { in: ["HungerStation", "hungerstation_invoice", "hungerstation_performance"] };
  if (display === "Talabat") return { in: ["Talabat", "talabat_invoice"] };
  return { equals: value };
}

function cityName(city?: { nameAr: string; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "غير محدد";
}

function driverName(driver?: { actualName: string | null; name: string } | null) {
  return driver?.actualName || driver?.name || "غير مربوط";
}

function projectName(project?: { name: string; appName: string | null } | null, appName?: string | null) {
  const appLabel = appDisplayName(appName || project?.appName);
  if (isKnownOperationalProject(appLabel)) return isKnownOperationalProject(project?.name) ? appDisplayName(project?.name) : appLabel;
  if (isKnownOperationalProject(project?.name)) return appDisplayName(project?.name);
  return project?.name || project?.appName || appLabel;
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeRate(value: unknown) {
  const numeric = toNumber(value);
  if (numeric > 0 && numeric <= 1) return Math.round(numeric * 1000) / 10;
  return Math.round(numeric * 10) / 10;
}

function avg(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10;
}

function scopeReportWhere(scope?: AccessScope): Prisma.DailyReportWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.DailyReportWhereInput[] = [];
  if (scope.driverId) and.push({ driverId: scope.driverId });
  if (scope.supervisorId) and.push({ driver: { is: { supervisorId: scope.supervisorId } } });
  if (scope.cityIds.length) and.push({ OR: [{ cityId: { in: scope.cityIds } }, { driver: { is: { cityId: { in: scope.cityIds } } } }] });
  if (scope.projectIds.length) and.push({ applicationProjectId: { in: scope.projectIds } });
  return and.length ? { AND: and } : { id: "__NO_ACCESS__" };
}

function scopedCityWhere(scope?: AccessScope): Prisma.CityWhereInput {
  if (!scope || scope.isGlobal || !scope.cityIds.length) return {};
  return { id: { in: scope.cityIds } };
}

function scopedApplicationProjectWhere(scope?: AccessScope): Prisma.ApplicationProjectWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.ApplicationProjectWhereInput[] = [];
  if (scope.projectIds.length) and.push({ id: { in: scope.projectIds } });
  if (scope.cityIds.length) and.push({ cityId: { in: scope.cityIds } });
  return and.length ? { AND: and } : {};
}

function scopedSupervisorWhere(scope?: AccessScope): Prisma.SupervisorWhereInput {
  if (!scope || scope.isGlobal) return {};
  if (scope.supervisorId) return { id: scope.supervisorId };
  if (scope.cityIds.length) return { cityId: { in: scope.cityIds } };
  return { id: "__NO_ACCESS__" };
}

function scopedDriverWhere(scope?: AccessScope): Prisma.DriverWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.DriverWhereInput[] = [];
  if (scope.driverId) and.push({ id: scope.driverId });
  if (scope.supervisorId) and.push({ supervisorId: scope.supervisorId });
  if (scope.cityIds.length) and.push({ cityId: { in: scope.cityIds } });
  if (scope.projectIds.length) and.push({ applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } });
  return and.length ? { AND: and } : { id: "__NO_ACCESS__" };
}

function statusFromReport(
  row: { orders: number; workingHours: number; onTimeRate: number; cancellationRate: number; rejectionRate: number },
  attendanceStatus?: unknown,
  hints?: { onShift?: boolean | null; validDay?: boolean | null; noShows?: unknown },
) {
  const daily = getDailyPerformanceStatus({
    attendanceStatus,
    orders: row.orders,
    minimumOrders: DAILY_MINIMUM_ORDERS,
    hints: { ...hints, workingHours: row.workingHours },
  });
  const warnings = [
    daily.warning,
    daily.shouldEvaluate && row.onTimeRate > 0 && row.onTimeRate < 95 ? "On-Time منخفض" : "",
    daily.shouldEvaluate && row.cancellationRate > 0 ? "إلغاء" : "",
    daily.shouldEvaluate && row.rejectionRate > 0 ? "رفض" : "",
  ].filter(Boolean);
  return {
    label: daily.performanceStatusLabel,
    warnings: warnings.length ? warnings : ["طبيعي"],
    tone: daily.tone,
    attendanceStatus: daily.attendanceStatusLabel,
    performanceStatus: daily.performanceStatusCode,
    warning: daily.warning,
    isWorkingDay: daily.shouldEvaluate,
  };
}

function textFromJson(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const text = String(record[key] ?? "").trim();
    if (text) return text;
  }
  return "";
}

type KeetaDailyHint = {
  shiftAttendanceSummary: string | null;
  onShift: boolean | null;
  validDay: boolean | null;
};

function dailyHintKey(args: { driverId?: string | null; applicationProjectId?: string | null; cityId?: string | null; reportDate: Date | string }) {
  const day = args.reportDate instanceof Date ? isoDate(args.reportDate) : args.reportDate;
  return [args.driverId ?? "", args.applicationProjectId ?? "", args.cityId ?? "", day].join(":");
}

function dailyHintKeys(args: { driverId?: string | null; applicationProjectId?: string | null; cityId?: string | null; reportDate: Date | string }) {
  if (!args.driverId) return [];
  return [
    dailyHintKey(args),
    dailyHintKey({ ...args, cityId: "" }),
    dailyHintKey({ ...args, applicationProjectId: "" }),
    dailyHintKey({ ...args, applicationProjectId: "", cityId: "" }),
  ];
}

function getDailyHint(hintMap: Map<string, KeetaDailyHint>, args: { driverId?: string | null; applicationProjectId?: string | null; cityId?: string | null; reportDate: Date | string }) {
  for (const key of dailyHintKeys(args)) {
    const hint = hintMap.get(key);
    if (hint) return hint;
  }
  return null;
}

export type DailyReportsFilters = {
  month: string;
  monthLabel: string;
  fromDate: string;
  toDate: string;
  cityId: string;
  projectId: string;
  appName: string;
  supervisorId: string;
  riderId: string;
  q: string;
  performanceStatus: string;
  currentEstimatedLevel: string;
  accessScope?: AccessScope;
};

export type DailyReportsOldData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: DailyReportsFilters;
  options: {
    months: string[];
    appNames: string[];
    cities: { id: string; name: string }[];
    projects: { id: string; name: string; appName: string }[];
    supervisors: { id: string; name: string }[];
    riders: { id: string; name: string; code: string }[];
    currentEstimatedLevels: string[];
  };
  summary: {
    reportsCount: number;
    uploadedReports: number;
    totalOrders: number;
    monthOrders: number;
    activeDrivers: number;
    avgWorkingHours: number;
    avgOnTime: number;
    avgCancellation: number;
    avgRejection: number;
    lastImport: string;
  };
  rows: {
    id: string;
    reportDate: string;
    driverId: string;
    cityId: string;
    supervisorId: string;
    driverName: string;
    driverCode: string;
    nationalId: string;
    phone: string;
    city: string;
    project: string;
    appName: string;
    account: string;
    supervisor: string;
    orders: number;
    workingHours: number;
    onTimeRate: number;
    acceptanceRate: number;
    cancellationRate: number;
    rejectionRate: number;
    currentEstimatedLevel: string;
    attendanceStatus: string;
    performanceStatus: DailyPerformanceStatusCode;
    warning: string;
    isWorkingDay: boolean;
    statusLabel: string;
    statusTone: "green" | "amber" | "red" | "slate" | "blue";
    warnings: string[];
    updatedAt: string;
  }[];
  uploadedReports: {
    id: string;
    fileName: string;
    importType: string;
    appName: string;
    month: string;
    rowsCount: number;
    status: string;
    uploadedBy: string;
    createdAt: string;
  }[];
  importBatches: {
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    missingDrivers: number;
    createdAt: string;
  }[];
  missingRows: {
    id: string;
    rowNumber: number;
    riderName: string;
    appUserId: string;
    errorType: string;
    errorMessage: string;
    status: string;
  }[];
};

export async function resolveDailyReportsFilters(params: SearchParams, accessScope?: AccessScope): Promise<DailyReportsFilters> {
  const scopeWhere = scopeReportWhere(accessScope);
  const [latestImportRow, latest] = await Promise.all([
    prisma.applicationImportRow
      .findFirst({
        where: {
          batch: { fileType: { in: ["keeta_period_report_template", "keeta_rank_template", "keeta_driver_invoice_template", "keeta_invoice", "keeta_rank", "hungerstation_invoice", "hungerstation_performance", "talabat_invoice"] } },
          driverId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { mappedData: true },
      })
      .catch(() => null),
    prisma.dailyReport.findFirst({ where: scopeWhere, orderBy: { reportDate: "desc" }, select: { reportDate: true, month: true } }).catch(() => null),
  ]);
  const latestImportDate = parseCompactDate(textFromJson(latestImportRow?.mappedData, ["reportDate", "date"]));
  const latestDate = latestImportDate || isoDate(latest?.reportDate) || new Date().toISOString().slice(0, 10);
  const requestedMonth = one(params, "month") || latest?.month || monthFromDate(latestDate);
  const fromDate = one(params, "fromDate") || latestDate;
  const toDate = one(params, "toDate") || fromDate;

  return {
    month: requestedMonth,
    monthLabel: monthLabel(requestedMonth),
    fromDate,
    toDate,
    cityId: one(params, "cityId"),
    projectId: one(params, "projectId"),
    appName: one(params, "appName"),
    supervisorId: one(params, "supervisorId"),
    riderId: one(params, "riderId") || one(params, "driverId"),
    q: one(params, "q").trim(),
    performanceStatus: one(params, "performanceStatus") || one(params, "status"),
    currentEstimatedLevel: one(params, "currentEstimatedLevel"),
    accessScope,
  };
}

function performanceStatusMatch(row: DailyReportsOldData["rows"][number], status: string) {
  const normalized = status.toLowerCase();
  if (!normalized) return true;
  const hasWarning = row.statusTone === "red" || row.warnings.some((warning) => warning && warning !== "طبيعي");
  if (["weakperformance", "weak", "needsfollowup", "bad"].includes(normalized)) return row.performanceStatus === "BELOW_MINIMUM";
  if (["warning", "critical", "criticalonly"].includes(normalized)) return hasWarning;
  if (["absent", "absence"].includes(normalized)) return row.performanceStatus === "ABSENT";
  if (["good", "normal", "green"].includes(normalized)) return !hasWarning;
  return true;
}

function levelMatch(row: DailyReportsOldData["rows"][number], currentEstimatedLevel: string) {
  if (!currentEstimatedLevel) return true;
  return row.currentEstimatedLevel === currentEstimatedLevel;
}

function emptyData(filters: DailyReportsFilters, message?: string): DailyReportsOldData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    options: { months: filters.month ? [filters.month] : [], appNames: [], cities: [], projects: [], supervisors: [], riders: [], currentEstimatedLevels: [] },
    summary: {
      reportsCount: 0,
      uploadedReports: 0,
      totalOrders: 0,
      monthOrders: 0,
      activeDrivers: 0,
      avgWorkingHours: 0,
      avgOnTime: 0,
      avgCancellation: 0,
      avgRejection: 0,
      lastImport: "-",
    },
    rows: [],
    uploadedReports: [],
    importBatches: [],
    missingRows: [],
  };
}

export async function getDailyReportsOldPageData(filters: DailyReportsFilters): Promise<DailyReportsOldData> {
  try {
    const driverWhere: Prisma.DriverWhereInput = scopedDriverWhere(filters.accessScope);
    if (filters.supervisorId) driverWhere.supervisorId = filters.supervisorId;
    if (filters.q) {
      driverWhere.OR = [
        { name: { contains: filters.q, mode: "insensitive" as const } },
        { actualName: { contains: filters.q, mode: "insensitive" as const } },
        { internalCode: { contains: filters.q, mode: "insensitive" as const } },
        { driverCode: { contains: filters.q, mode: "insensitive" as const } },
        { nationalId: { contains: filters.q, mode: "insensitive" as const } },
        { phone: { contains: filters.q, mode: "insensitive" as const } },
        { mobile: { contains: filters.q, mode: "insensitive" as const } },
      ];
    }

    const reportWhere: Prisma.DailyReportWhereInput = {
      AND: [
        scopeReportWhere(filters.accessScope),
        {
          reportDate: {
            gte: startOfDay(filters.fromDate),
            lte: endOfDay(filters.toDate),
          },
        },
        filters.cityId ? { cityId: filters.cityId } : {},
        filters.projectId ? { applicationProjectId: filters.projectId } : {},
        filters.appName ? { appName: appWhere(filters.appName) } : {},
        filters.riderId ? { driverId: filters.riderId } : {},
        Object.keys(driverWhere).length ? { driver: driverWhere } : {},
      ].filter((item) => Object.keys(item).length),
    };

    const monthWhere: Prisma.DailyReportWhereInput = {
      AND: [
        scopeReportWhere(filters.accessScope),
        { month: filters.month },
        filters.cityId ? { cityId: filters.cityId } : {},
        filters.projectId ? { applicationProjectId: filters.projectId } : {},
        filters.appName ? { appName: appWhere(filters.appName) } : {},
      ].filter((item) => Object.keys(item).length),
    };

    const includeKeetaHints = !filters.appName || appDisplayName(filters.appName) === "Keeta";
    const keetaHintScopeAnd: Prisma.KeetaPerformanceRecordWhereInput[] = [];
    if (filters.accessScope && !filters.accessScope.isGlobal) {
      if (filters.accessScope.driverId) keetaHintScopeAnd.push({ driverId: filters.accessScope.driverId });
      if (filters.accessScope.cityIds.length) keetaHintScopeAnd.push({ cityId: { in: filters.accessScope.cityIds } });
      if (filters.accessScope.projectIds.length) keetaHintScopeAnd.push({ applicationProjectId: { in: filters.accessScope.projectIds } });
      if (filters.accessScope.supervisorId) keetaHintScopeAnd.push({ driver: { is: { supervisorId: filters.accessScope.supervisorId } } });
    }
    const keetaHintWhere: Prisma.KeetaPerformanceRecordWhereInput = includeKeetaHints
      ? {
          AND: [
            ...keetaHintScopeAnd,
            {
              reportDate: {
                gte: startOfDay(filters.fromDate),
                lte: endOfDay(filters.toDate),
              },
            },
            filters.cityId ? { cityId: filters.cityId } : {},
            filters.projectId ? { applicationProjectId: filters.projectId } : {},
            filters.riderId ? { driverId: filters.riderId } : {},
          ].filter((item) => Object.keys(item).length),
        }
      : { id: "__NO_KEETA_HINTS__" };

    const [reports, monthReports, uploadedReports, importBatches, latestBatch, cities, projects, supervisors, riders, monthRows, appRows, levelRows, keetaHints] = await Promise.all([
      prisma.dailyReport.findMany({
        where: reportWhere,
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
          applicationProject: { select: { id: true, name: true, application: { select: { name: true } } } },
          driver: {
            select: {
              id: true,
              name: true,
              actualName: true,
              internalCode: true,
              driverCode: true,
              nationalId: true,
              phone: true,
              mobile: true,
              currentEstimatedLevel: true,
              cityId: true,
              supervisorId: true,
              supervisor: { select: { id: true, name: true } },
              account: { select: { username: true, appUserId: true, appUsername: true } },
              applicationAccounts: { select: { username: true, appUserId: true, appUsername: true }, take: 1 },
            },
          },
        },
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
        take: 600,
      }),
      prisma.dailyReport.findMany({ where: monthWhere, select: { orders: true, driverId: true } }),
      prisma.uploadedReport.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.applicationImportBatch.findMany({
        where: { fileType: { in: ["keeta_period_report_template", "keeta_rank_template", "keeta_driver_invoice_template", "keeta_invoice", "keeta_rank", "hungerstation_invoice", "hungerstation_performance", "talabat_invoice"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.applicationImportBatch.findFirst({
        where: { fileType: { in: ["keeta_period_report_template", "keeta_rank_template", "keeta_driver_invoice_template", "keeta_invoice", "keeta_rank", "hungerstation_invoice", "hungerstation_performance", "talabat_invoice"] } },
        orderBy: { createdAt: "desc" },
        include: {
          rows: {
            where: { status: "invalid" },
            orderBy: { rowNumber: "asc" },
            take: 30,
          },
        },
      }),
      prisma.city.findMany({ where: scopedCityWhere(filters.accessScope), select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
      prisma.applicationProject.findMany({
        where: scopedApplicationProjectWhere(filters.accessScope),
        select: { id: true, name: true, application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: [{ application: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.supervisor.findMany({ where: scopedSupervisorWhere(filters.accessScope), select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.driver.findMany({ where: scopedDriverWhere(filters.accessScope), select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true }, orderBy: { name: "asc" }, take: 500 }),
      prisma.dailyReport.findMany({ where: scopeReportWhere(filters.accessScope), select: { month: true }, distinct: ["month"], orderBy: { month: "desc" }, take: 12 }),
      prisma.dailyReport.findMany({ where: scopeReportWhere(filters.accessScope), select: { appName: true }, distinct: ["appName"], orderBy: { appName: "asc" } }),
      prisma.driver.findMany({
        where: { AND: [scopedDriverWhere(filters.accessScope), { currentEstimatedLevel: { not: null } }] },
        distinct: ["currentEstimatedLevel"],
        select: { currentEstimatedLevel: true },
        take: 100,
      }),
      prisma.keetaPerformanceRecord.findMany({
        where: keetaHintWhere,
        select: {
          driverId: true,
          applicationProjectId: true,
          cityId: true,
          reportDate: true,
          shiftAttendanceSummary: true,
          onShift: true,
          validDay: true,
        },
        orderBy: [{ reportDate: "desc" }, { updatedAt: "desc" }],
        take: 3000,
      }).catch(() => []),
    ]);

    const keetaHintMap = new Map<string, KeetaDailyHint>();
    for (const hint of keetaHints) {
      for (const key of dailyHintKeys(hint)) {
        if (!keetaHintMap.has(key)) {
          keetaHintMap.set(key, {
            shiftAttendanceSummary: hint.shiftAttendanceSummary,
            onShift: hint.onShift,
            validDay: hint.validDay,
          });
        }
      }
    }

    const hsScopeAnd: Prisma.HungerStationDailyPerformanceRecordWhereInput[] = [];
    if (filters.accessScope && !filters.accessScope.isGlobal) {
      if (filters.accessScope.driverId) hsScopeAnd.push({ driverId: filters.accessScope.driverId });
      if (filters.accessScope.cityIds.length) hsScopeAnd.push({ cityId: { in: filters.accessScope.cityIds } });
      if (filters.accessScope.projectIds.length) hsScopeAnd.push({ applicationProjectId: { in: filters.accessScope.projectIds } });
      if (filters.accessScope.supervisorId) hsScopeAnd.push({ driver: { is: { supervisorId: filters.accessScope.supervisorId } } });
    }
    const includeHungerStationRows = !filters.appName || appDisplayName(filters.appName) === "HungerStation";
    const hsWhere: Prisma.HungerStationDailyPerformanceRecordWhereInput = includeHungerStationRows
      ? {
          AND: [
            ...hsScopeAnd,
            {
              reportDate: {
                gte: startOfDay(filters.fromDate),
                lte: endOfDay(filters.toDate),
              },
            },
            filters.cityId ? { cityId: filters.cityId } : {},
            filters.projectId ? { applicationProjectId: filters.projectId } : {},
            filters.riderId ? { driverId: filters.riderId } : {},
            filters.q
              ? {
                  OR: [
                    { riderIdFromFile: { contains: filters.q, mode: "insensitive" as const } },
                    { driver: { is: { name: { contains: filters.q, mode: "insensitive" as const } } } },
                    { driver: { is: { actualName: { contains: filters.q, mode: "insensitive" as const } } } },
                    { driver: { is: { internalCode: { contains: filters.q, mode: "insensitive" as const } } } },
                    { driver: { is: { driverCode: { contains: filters.q, mode: "insensitive" as const } } } },
                    { driver: { is: { phone: { contains: filters.q, mode: "insensitive" as const } } } },
                    { driver: { is: { mobile: { contains: filters.q, mode: "insensitive" as const } } } },
                  ],
                }
              : {},
          ].filter((item) => Object.keys(item).length),
        }
      : { id: "__NO_HUNGERSTATION_ROWS__" };

    const hsMonthWhere: Prisma.HungerStationDailyPerformanceRecordWhereInput = includeHungerStationRows
      ? {
          AND: [
            ...hsScopeAnd,
            { month: filters.month },
            filters.cityId ? { cityId: filters.cityId } : {},
            filters.projectId ? { applicationProjectId: filters.projectId } : {},
          ].filter((item) => Object.keys(item).length),
        }
      : { id: "__NO_HUNGERSTATION_ROWS__" };

    const [hsReports, hsMonthReports, hsMonthRows] = await Promise.all([
      prisma.hungerStationDailyPerformanceRecord.findMany({
        where: hsWhere,
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          applicationProject: { select: { id: true, name: true, application: { select: { name: true } } } },
          applicationAccount: { select: { username: true, appUserId: true, appUsername: true } },
          driver: {
            select: {
              id: true,
              name: true,
              actualName: true,
              internalCode: true,
              driverCode: true,
              nationalId: true,
              phone: true,
              mobile: true,
              currentEstimatedLevel: true,
              cityId: true,
              supervisorId: true,
              supervisor: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
        take: 600,
      }),
      prisma.hungerStationDailyPerformanceRecord.findMany({ where: hsMonthWhere, select: { completedDeliveries: true, driverId: true } }),
      prisma.hungerStationDailyPerformanceRecord.findMany({ where: hsScopeAnd.length ? { AND: hsScopeAnd } : {}, select: { month: true }, distinct: ["month"], orderBy: { month: "desc" }, take: 12 }),
    ]);

    const rows = reports.map((report) => {
      const driver = report.driver;
      const account = driver?.account ?? driver?.applicationAccounts[0] ?? null;
      const appNameValue = appDisplayName(report.applicationProject?.application.name || report.appName || report.project?.appName);
      const normalized = {
        orders: report.orders,
        workingHours: toNumber(report.workingHours),
        onTimeRate: normalizeRate(report.onTimeRate),
        cancellationRate: normalizeRate(report.cancellationRate),
        rejectionRate: normalizeRate(report.rejectionRate),
      };
      const hint = getDailyHint(keetaHintMap, {
        driverId: report.driverId,
        applicationProjectId: report.applicationProjectId,
        cityId: report.cityId || driver?.cityId,
        reportDate: report.reportDate,
      });
      const status = statusFromReport(normalized, hint?.shiftAttendanceSummary, {
        onShift: hint?.onShift,
        validDay: hint?.validDay,
      });
      return {
        id: report.id,
        reportDate: isoDate(report.reportDate),
        driverId: driver?.id ?? "",
        cityId: report.cityId || driver?.cityId || "",
        supervisorId: driver?.supervisorId || driver?.supervisor?.id || "",
        driverName: driverName(driver),
        driverCode: driver?.internalCode || driver?.driverCode || "-",
        nationalId: driver?.nationalId || "-",
        phone: driver?.phone || driver?.mobile || "-",
        city: cityName(report.city),
        project: report.applicationProject?.name || projectName(report.project, report.appName),
        appName: appNameValue,
        account: account?.appUserId || account?.appUsername || account?.username || "-",
        supervisor: driver?.supervisor?.name || "بدون مشرف",
        orders: normalized.orders,
        workingHours: Math.round(normalized.workingHours * 10) / 10,
        onTimeRate: normalized.onTimeRate,
        acceptanceRate: normalized.onTimeRate,
        cancellationRate: normalized.cancellationRate,
        rejectionRate: normalized.rejectionRate,
        currentEstimatedLevel: displayCurrentEstimatedLevel(driver?.currentEstimatedLevel),
        attendanceStatus: status.attendanceStatus,
        performanceStatus: status.performanceStatus,
        warning: status.warning,
        isWorkingDay: status.isWorkingDay,
        statusLabel: status.label,
        statusTone: status.tone,
        warnings: status.warnings,
        updatedAt: isoDate(report.updatedAt),
      };
    });

    const hsRows = hsReports.map((report) => {
      const driver = report.driver;
      const account = report.applicationAccount;
      const attendance = normalizeRate(report.attendanceRate);
      const acceptance = normalizeRate(report.acceptanceRate);
      const cancelled = toNumber(report.cancelledDeliveries);
      const declined = toNumber(report.declinedDeliveries);
      const status = statusFromReport(
        {
          orders: toNumber(report.completedDeliveries),
          workingHours: toNumber(report.actualWorkingHours),
          onTimeRate: acceptance,
          cancellationRate: cancelled,
          rejectionRate: declined,
        },
        textFromJson(report.rawData, ["Attendance Status", "attendanceStatus", "Attendance", "Status", "status"]),
        { noShows: report.noShows, validDay: toNumber(report.workingDays) > 0 ? true : null },
      );
      const warnings = [
        report.matchingStatus !== "MATCHED" ? "يحتاج ربط حساب" : "طبيعي",
        ...status.warnings.filter((warning) => warning !== "طبيعي"),
        status.isWorkingDay && attendance && attendance < 85 ? "حضور منخفض" : "",
        status.isWorkingDay && acceptance && acceptance < 85 ? "قبول منخفض" : "",
        status.isWorkingDay && cancelled > 0 ? "طلبات ملغاة" : "",
        status.isWorkingDay && declined > 0 ? "طلبات مرفوضة" : "",
      ].filter(Boolean);
      return {
        id: report.id,
        reportDate: isoDate(report.reportDate),
        driverId: driver?.id ?? "",
        cityId: report.cityId || driver?.cityId || "",
        supervisorId: driver?.supervisorId || driver?.supervisor?.id || "",
        driverName: driverName(driver),
        driverCode: driver?.internalCode || driver?.driverCode || report.riderIdFromFile || "-",
        nationalId: driver?.nationalId || "-",
        phone: driver?.phone || driver?.mobile || "-",
        city: cityName(report.city),
        project: report.applicationProject?.name || "HungerStation",
        appName: "HungerStation",
        account: account?.appUserId || account?.appUsername || account?.username || report.riderIdFromFile || "-",
        supervisor: driver?.supervisor?.name || "بدون مشرف",
        orders: toNumber(report.completedDeliveries),
        workingHours: Math.round(toNumber(report.actualWorkingHours) * 10) / 10,
        onTimeRate: attendance,
        acceptanceRate: acceptance,
        cancellationRate: cancelled,
        rejectionRate: declined,
        currentEstimatedLevel: displayCurrentEstimatedLevel(driver?.currentEstimatedLevel),
        attendanceStatus: status.attendanceStatus,
        performanceStatus: status.performanceStatus,
        warning: status.warning,
        isWorkingDay: status.isWorkingDay,
        statusLabel: report.matchingStatus === "MATCHED" ? status.label : "مراجعة حساب",
        statusTone: report.matchingStatus === "MATCHED" ? status.tone : ("red" as const),
        warnings: warnings.length ? warnings : ["طبيعي"],
        updatedAt: isoDate(report.updatedAt),
      };
    });

    const allRows = [...rows, ...hsRows]
      .filter((row) => performanceStatusMatch(row, filters.performanceStatus))
      .filter((row) => levelMatch(row, filters.currentEstimatedLevel))
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate));

    const missingRows =
      latestBatch?.rows.map((row) => ({
        id: row.id,
        rowNumber: row.rowNumber,
        riderName: [textFromJson(row.mappedData, ["courierFirstName"]), textFromJson(row.mappedData, ["courierLastName"])].filter(Boolean).join(" ") || "غير معروف",
        appUserId: textFromJson(row.mappedData, ["appUserId", "appUsername"]),
        errorType: row.errorType || "-",
        errorMessage: row.errorMessage || "لم يتم ربط الصف بمندوب.",
        status: row.status,
      })) ?? [];

    const allAppNames = Array.from(new Set([...appRows.map((row) => appDisplayName(row.appName)), ...(hsReports.length ? ["HungerStation"] : [])].filter(Boolean)));
    const currentEstimatedLevels = Array.from(
      new Set(
        levelRows
          .map((row) => displayCurrentEstimatedLevel(row.currentEstimatedLevel))
          .filter((level) => level !== "Not Available"),
      ),
    ).sort((a, b) => a.localeCompare(b, "ar"));
    const uniqueProjects = Array.from(
      new Map(
        projects
          .map((project) => ({
            id: project.id,
            name: project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim(),
            appName: appDisplayName(project.application.name),
          }))
          .map((project) => [`${project.name}:${project.appName}`, project] as const),
      ).values(),
    );
    const lastImport = importBatches[0]?.createdAt ? isoDate(importBatches[0].createdAt) : uploadedReports[0]?.createdAt ? isoDate(uploadedReports[0].createdAt) : "-";
    const workingRows = allRows.filter((row) => row.isWorkingDay);
    const hourRows = workingRows.length ? workingRows : allRows;

    return {
      databaseStatus: "online",
      filters,
      options: {
        months: Array.from(new Set([filters.month, ...monthRows.map((row) => row.month), ...hsMonthRows.map((row) => row.month)].filter(Boolean))),
        appNames: allAppNames,
        cities: cities.map((city) => ({ id: city.id, name: cityName(city) })),
        projects: uniqueProjects,
        supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name })),
        riders: riders.map((rider) => ({ id: rider.id, name: driverName(rider), code: rider.internalCode || rider.driverCode || "-" })),
        currentEstimatedLevels,
      },
      summary: {
        reportsCount: allRows.length,
        uploadedReports: uploadedReports.length,
        totalOrders: allRows.reduce((sum, row) => sum + row.orders, 0),
        monthOrders: monthReports.reduce((sum, row) => sum + row.orders, 0) + hsMonthReports.reduce((sum, row) => sum + toNumber(row.completedDeliveries), 0),
        activeDrivers: new Set(allRows.map((row) => row.driverId).filter(Boolean)).size,
        avgWorkingHours: avg(hourRows.map((row) => row.workingHours)),
        avgOnTime: avg(allRows.map((row) => row.onTimeRate)),
        avgCancellation: avg(allRows.map((row) => row.cancellationRate)),
        avgRejection: avg(allRows.map((row) => row.rejectionRate)),
        lastImport,
      },
      rows: allRows,
      uploadedReports: uploadedReports.map((report) => ({
        id: report.id,
        fileName: report.fileName,
        importType: report.importType,
        appName: appDisplayName(report.appName || report.importType),
        month: report.month || "-",
        rowsCount: report.rowsCount,
        status: String(report.status),
        uploadedBy: report.uploadedBy || "-",
        createdAt: isoDate(report.createdAt),
      })),
      importBatches: importBatches.map((batch) => ({
        id: batch.id,
        fileName: batch.fileName || "-",
        fileType: batch.fileType,
        status: batch.status,
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
        missingDrivers: batch.missingDrivers,
        createdAt: isoDate(batch.createdAt),
      })),
      missingRows,
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}
