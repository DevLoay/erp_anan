import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/auth/accessScope";
import { databaseOfflineMessage } from "@/lib/imports/templates";
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
  if (scope.projectIds.length) and.push({ OR: [{ projectId: { in: scope.projectIds } }, { driver: { is: { projectId: { in: scope.projectIds } } } }] });
  return and.length ? { AND: and } : { id: "__NO_ACCESS__" };
}

function scopedCityWhere(scope?: AccessScope): Prisma.CityWhereInput {
  if (!scope || scope.isGlobal || !scope.cityIds.length) return {};
  return { id: { in: scope.cityIds } };
}

function scopedProjectWhere(scope?: AccessScope): Prisma.ProjectWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.ProjectWhereInput[] = [];
  if (scope.projectIds.length) and.push({ id: { in: scope.projectIds } });
  if (scope.cityIds.length) and.push({ OR: [{ cityId: { in: scope.cityIds } }, { reports: { some: { cityId: { in: scope.cityIds } } } }] });
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
  if (scope.projectIds.length) and.push({ projectId: { in: scope.projectIds } });
  return and.length ? { AND: and } : { id: "__NO_ACCESS__" };
}

function statusFromReport(row: { orders: number; workingHours: number; onTimeRate: number; cancellationRate: number; rejectionRate: number }) {
  const warnings: string[] = [];
  if (row.orders < 10) warnings.push("طلبات قليلة");
  if (row.workingHours < 8) warnings.push("ساعات منخفضة");
  if (row.onTimeRate < 95) warnings.push("On-Time منخفض");
  if (row.cancellationRate > 0) warnings.push("إلغاء");
  if (row.rejectionRate > 0) warnings.push("رفض");
  return warnings.length ? { label: "يحتاج متابعة", warnings, tone: "red" as const } : { label: "طبيعي", warnings: ["طبيعي"], tone: "green" as const };
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
    cancellationRate: number;
    rejectionRate: number;
    statusLabel: string;
    statusTone: "green" | "red";
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
    accessScope,
  };
}

function emptyData(filters: DailyReportsFilters, message?: string): DailyReportsOldData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    options: { months: filters.month ? [filters.month] : [], appNames: [], cities: [], projects: [], supervisors: [], riders: [] },
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
        { name: { contains: filters.q, mode: "insensitive" } },
        { actualName: { contains: filters.q, mode: "insensitive" } },
        { internalCode: { contains: filters.q, mode: "insensitive" } },
        { driverCode: { contains: filters.q, mode: "insensitive" } },
        { nationalId: { contains: filters.q, mode: "insensitive" } },
        { phone: { contains: filters.q, mode: "insensitive" } },
        { mobile: { contains: filters.q, mode: "insensitive" } },
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
        filters.projectId ? { projectId: filters.projectId } : {},
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
        filters.projectId ? { projectId: filters.projectId } : {},
        filters.appName ? { appName: appWhere(filters.appName) } : {},
      ].filter((item) => Object.keys(item).length),
    };

    const [reports, monthReports, uploadedReports, importBatches, latestBatch, cities, projects, supervisors, riders, monthRows, appRows] = await Promise.all([
      prisma.dailyReport.findMany({
        where: reportWhere,
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
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
              supervisor: { select: { name: true } },
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
      prisma.project.findMany({
        where: { AND: [{ reports: { some: scopeReportWhere(filters.accessScope) } }, scopedProjectWhere(filters.accessScope)] },
        select: { id: true, name: true, appName: true },
        orderBy: { name: "asc" },
      }),
      prisma.supervisor.findMany({ where: scopedSupervisorWhere(filters.accessScope), select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.driver.findMany({ where: scopedDriverWhere(filters.accessScope), select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true }, orderBy: { name: "asc" }, take: 500 }),
      prisma.dailyReport.findMany({ where: scopeReportWhere(filters.accessScope), select: { month: true }, distinct: ["month"], orderBy: { month: "desc" }, take: 12 }),
      prisma.dailyReport.findMany({ where: scopeReportWhere(filters.accessScope), select: { appName: true }, distinct: ["appName"], orderBy: { appName: "asc" } }),
    ]);

    const rows = reports.map((report) => {
      const driver = report.driver;
      const account = driver?.account ?? driver?.applicationAccounts[0] ?? null;
      const normalized = {
        orders: report.orders,
        workingHours: toNumber(report.workingHours),
        onTimeRate: normalizeRate(report.onTimeRate),
        cancellationRate: normalizeRate(report.cancellationRate),
        rejectionRate: normalizeRate(report.rejectionRate),
      };
      const status = statusFromReport(normalized);
      return {
        id: report.id,
        reportDate: isoDate(report.reportDate),
        driverId: driver?.id ?? "",
        driverName: driverName(driver),
        driverCode: driver?.internalCode || driver?.driverCode || "-",
        nationalId: driver?.nationalId || "-",
        phone: driver?.phone || driver?.mobile || "-",
        city: cityName(report.city),
        project: projectName(report.project, report.appName),
        appName: appDisplayName(report.appName || report.project?.appName),
        account: account?.appUserId || account?.appUsername || account?.username || "-",
        supervisor: driver?.supervisor?.name || "بدون مشرف",
        orders: normalized.orders,
        workingHours: Math.round(normalized.workingHours * 10) / 10,
        onTimeRate: normalized.onTimeRate,
        cancellationRate: normalized.cancellationRate,
        rejectionRate: normalized.rejectionRate,
        statusLabel: status.label,
        statusTone: status.tone,
        warnings: status.warnings,
        updatedAt: isoDate(report.updatedAt),
      };
    });

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

    const allAppNames = Array.from(new Set(appRows.map((row) => appDisplayName(row.appName)).filter(Boolean)));
    const uniqueProjects = Array.from(
      new Map(
        projects
          .filter((project) => isKnownOperationalProject(project.name) || isKnownOperationalProject(project.appName))
          .map((project) => ({
            id: project.id,
            name: isKnownOperationalProject(project.appName) ? appDisplayName(project.appName) : appDisplayName(project.name),
            appName: isKnownOperationalProject(project.appName) ? appDisplayName(project.appName) : "",
          }))
          .map((project) => [`${project.name}:${project.appName}`, project] as const),
      ).values(),
    );
    const lastImport = importBatches[0]?.createdAt ? isoDate(importBatches[0].createdAt) : uploadedReports[0]?.createdAt ? isoDate(uploadedReports[0].createdAt) : "-";

    return {
      databaseStatus: "online",
      filters,
      options: {
        months: Array.from(new Set([filters.month, ...monthRows.map((row) => row.month)].filter(Boolean))),
        appNames: allAppNames,
        cities: cities.map((city) => ({ id: city.id, name: cityName(city) })),
        projects: uniqueProjects,
        supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name })),
        riders: riders.map((rider) => ({ id: rider.id, name: driverName(rider), code: rider.internalCode || rider.driverCode || "-" })),
      },
      summary: {
        reportsCount: rows.length,
        uploadedReports: uploadedReports.length,
        totalOrders: rows.reduce((sum, row) => sum + row.orders, 0),
        monthOrders: monthReports.reduce((sum, row) => sum + row.orders, 0),
        activeDrivers: new Set(rows.map((row) => row.driverId).filter(Boolean)).size,
        avgWorkingHours: avg(rows.map((row) => row.workingHours)),
        avgOnTime: avg(rows.map((row) => row.onTimeRate)),
        avgCancellation: avg(rows.map((row) => row.cancellationRate)),
        avgRejection: avg(rows.map((row) => row.rejectionRate)),
        lastImport,
      },
      rows,
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
