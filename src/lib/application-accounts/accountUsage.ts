import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

type UsageInput = {
  applicationAccountId: string;
  applicationId?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
  ownerDriverId?: string | null;
  actualDriverId?: string | null;
  month: string;
  usageDate?: Date | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  source: string;
  status?: string | null;
  usageType?: string | null;
  reviewReason?: string | null;
  rawData?: Prisma.InputJsonValue | null;
  appName?: string | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function appKey(value: unknown) {
  return text(value).toLowerCase().replace(/[\s_-]+/g, "");
}

function isKeeta(value: unknown) {
  return appKey(value).includes("keeta") || text(value).includes("كيتا");
}

function isHungerStation(value: unknown) {
  const key = appKey(value);
  return key.includes("hungerstation") || key.includes("hunger") || text(value).includes("هنجر") || text(value).includes("هنقر");
}

export function monthDateRange(month: string) {
  const safeMonth = /^20\d{2}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = safeMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { start, end };
}

export function accountUsageType(args: {
  appName?: string | null;
  ownerDriverId?: string | null;
  actualDriverId?: string | null;
}) {
  if (!args.actualDriverId) return "NEEDS_REVIEW";
  if (!args.ownerDriverId) return "ACTUAL_WORKER";
  if (args.ownerDriverId === args.actualDriverId) return "OWNER";
  if (isHungerStation(args.appName)) return "SHARED";
  if (isKeeta(args.appName)) return "SHARED";
  return "ACTUAL_WORKER";
}

export function accountUsageRisk(args: {
  appName?: string | null;
  ownerDriverId?: string | null;
  actualDriverIds: string[];
  hasInvoice?: boolean;
  hasDailyData?: boolean;
}) {
  const actualIds = Array.from(new Set(args.actualDriverIds.filter(Boolean)));
  if (isKeeta(args.appName) && actualIds.length && args.ownerDriverId && actualIds.some((id) => id !== args.ownerDriverId)) return "CRITICAL";
  if (actualIds.length > 1) return "HIGH";
  if (!args.ownerDriverId || actualIds.length === 0) return "MEDIUM";
  if ((args.hasInvoice || args.hasDailyData) && actualIds.length === 0) return "MEDIUM";
  return "LOW";
}

function defaultStatus(args: {
  appName?: string | null;
  usageType: string;
  actualDriverId?: string | null;
}) {
  if (!args.actualDriverId) return "PENDING";
  if (isKeeta(args.appName) && args.usageType === "SHARED") return "PENDING";
  return "APPROVED";
}

export async function upsertAccountUsage(db: Db, input: UsageInput) {
  if (!input.applicationAccountId || !input.month || !input.source) return null;

  const usageType = input.usageType || accountUsageType({
    appName: input.appName,
    ownerDriverId: input.ownerDriverId,
    actualDriverId: input.actualDriverId,
  });

  const data = {
    applicationAccountId: input.applicationAccountId,
    applicationId: input.applicationId || null,
    applicationProjectId: input.applicationProjectId || null,
    cityId: input.cityId || null,
    ownerDriverId: input.ownerDriverId || null,
    actualDriverId: input.actualDriverId || null,
    month: input.month,
    usageDate: input.usageDate || null,
    dateFrom: input.dateFrom || input.usageDate || null,
    dateTo: input.dateTo || input.usageDate || null,
    source: input.source,
    status: input.status || defaultStatus({ appName: input.appName, usageType, actualDriverId: input.actualDriverId }),
    usageType,
    reviewReason: input.reviewReason || null,
    rawData: input.rawData ?? Prisma.JsonNull,
  };

  const existing = await db.accountUsage.findFirst({
    where: {
      applicationAccountId: input.applicationAccountId,
      month: input.month,
      source: input.source,
      usageDate: input.usageDate || null,
      applicationProjectId: input.applicationProjectId || null,
      cityId: input.cityId || null,
    },
    select: { id: true },
  });

  if (existing) {
    return db.accountUsage.update({ where: { id: existing.id }, data });
  }
  return db.accountUsage.create({ data });
}

export type AccountUsageReviewFilters = {
  month?: string;
  applicationId?: string;
  applicationProjectId?: string;
  cityId?: string;
  q?: string;
};

function usageWhere(filters: AccountUsageReviewFilters): Prisma.AccountUsageWhereInput {
  const where: Prisma.AccountUsageWhereInput = {};
  if (filters.month) where.month = filters.month;
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.applicationProjectId) where.applicationProjectId = filters.applicationProjectId;
  if (filters.cityId) where.cityId = filters.cityId;
  if (filters.q) {
    where.OR = [
      { applicationAccount: { appUserId: { contains: filters.q, mode: "insensitive" } } },
      { applicationAccount: { appUsername: { contains: filters.q, mode: "insensitive" } } },
      { ownerDriver: { name: { contains: filters.q, mode: "insensitive" } } },
      { actualDriver: { name: { contains: filters.q, mode: "insensitive" } } },
      { actualDriver: { actualName: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

function accountIssueWhere(filters: AccountUsageReviewFilters): Prisma.ApplicationAccountWhereInput {
  const and: Prisma.ApplicationAccountWhereInput[] = [
    {
      OR: [
        { needsReview: true },
        { applicationProjectId: null },
        { cityId: null },
        { driverId: null },
        { unmatchedReason: { not: null } },
      ],
    },
  ];
  if (filters.applicationId) and.push({ applicationId: filters.applicationId });
  if (filters.applicationProjectId) and.push({ applicationProjectId: filters.applicationProjectId });
  if (filters.cityId) and.push({ cityId: filters.cityId });
  if (filters.q) {
    and.push({
      OR: [
        { appName: { contains: filters.q, mode: "insensitive" } },
        { appUserId: { contains: filters.q, mode: "insensitive" } },
        { appUsername: { contains: filters.q, mode: "insensitive" } },
        { username: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

function groupKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part || "-").join("|");
}

export async function getAccountUsageReviewData(filters: AccountUsageReviewFilters) {
  const [usages, accountIssues, dailyRows, invoiceRows, applications, projects, cities] = await Promise.all([
    prisma.accountUsage.findMany({
      where: usageWhere(filters),
      include: {
        application: { select: { id: true, name: true, code: true } },
        applicationProject: { select: { id: true, name: true, code: true } },
        city: { select: { id: true, nameAr: true, nameEn: true } },
        applicationAccount: {
          select: {
            id: true,
            appName: true,
            appUserId: true,
            appUsername: true,
            username: true,
            status: true,
            needsReview: true,
            unmatchedReason: true,
            driver: { select: { id: true, name: true, actualName: true, internalCode: true } },
          },
        },
        ownerDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
        actualDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
      },
      orderBy: [{ month: "desc" }, { updatedAt: "desc" }],
      take: 1200,
    }),
    prisma.applicationAccount.findMany({
      where: accountIssueWhere(filters),
      include: {
        application: { select: { id: true, name: true, code: true } },
        applicationProject: { select: { id: true, name: true, code: true } },
        city: { select: { id: true, nameAr: true, nameEn: true } },
        driver: { select: { id: true, name: true, actualName: true, internalCode: true } },
      },
      orderBy: [{ needsReview: "desc" }, { updatedAt: "desc" }],
      take: 300,
    }),
    prisma.hungerStationDailyPerformanceRecord.findMany({
      where: {
        ...(filters.month ? { month: filters.month } : {}),
        ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
        ...(filters.cityId ? { cityId: filters.cityId } : {}),
      },
      select: {
        month: true,
        riderIdFromFile: true,
        applicationProjectId: true,
        cityId: true,
        applicationAccountId: true,
        driverId: true,
        completedDeliveries: true,
        actualWorkingHours: true,
        attendanceRate: true,
        acceptanceRate: true,
      },
      take: 5000,
    }),
    prisma.hungerStationInvoiceRecord.findMany({
      where: {
        ...(filters.month ? { month: filters.month } : {}),
        ...(filters.applicationProjectId ? { applicationProjectId: filters.applicationProjectId } : {}),
        ...(filters.cityId ? { cityId: filters.cityId } : {}),
      },
      select: {
        month: true,
        riderIdFromFile: true,
        applicationProjectId: true,
        cityId: true,
        applicationAccountId: true,
        driverId: true,
        completedOrders: true,
        riderBalance: true,
      },
      take: 5000,
    }),
    prisma.application.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.applicationProject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, applicationId: true, cityId: true } }),
    prisma.city.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
  ]);

  const dailyByKey = new Map<string, { count: number; completed: number; hours: number; driverIds: Set<string> }>();
  for (const row of dailyRows) {
    const key = groupKey([row.applicationProjectId, row.cityId, row.month, row.applicationAccountId || row.riderIdFromFile]);
    const current = dailyByKey.get(key) ?? { count: 0, completed: 0, hours: 0, driverIds: new Set<string>() };
    current.count += 1;
    current.completed += Number(row.completedDeliveries ?? 0);
    current.hours += Number(row.actualWorkingHours ?? 0);
    if (row.driverId) current.driverIds.add(row.driverId);
    dailyByKey.set(key, current);
  }

  const invoiceByKey = new Map<string, { count: number; completed: number; balance: number; driverIds: Set<string> }>();
  for (const row of invoiceRows) {
    const key = groupKey([row.applicationProjectId, row.cityId, row.month, row.applicationAccountId || row.riderIdFromFile]);
    const current = invoiceByKey.get(key) ?? { count: 0, completed: 0, balance: 0, driverIds: new Set<string>() };
    current.count += 1;
    current.completed += Number(row.completedOrders ?? 0);
    current.balance += Number(row.riderBalance ?? 0);
    if (row.driverId) current.driverIds.add(row.driverId);
    invoiceByKey.set(key, current);
  }

  const groups = new Map<string, {
    id: string;
    month: string;
    applicationName: string;
    applicationProjectName: string;
    cityName: string;
    appUserId: string;
    accountName: string;
    accountOwner: string;
    actualWorkers: string[];
    actualWorkerIds: string[];
    dailyRecordsCount: number;
    invoiceExists: boolean;
    completedOrders: number;
    actualWorkingHours: number;
    riskLevel: string;
    reviewReason: string;
    status: string;
    applicationAccountId: string;
  }>();

  for (const usage of usages) {
    const key = groupKey([usage.applicationProjectId, usage.cityId, usage.month, usage.applicationAccountId]);
    const appName = usage.application?.name || usage.applicationAccount.appName || "";
    const daily = dailyByKey.get(key);
    const invoice = invoiceByKey.get(key);
    const existing = groups.get(key);
    const owner = usage.ownerDriver || usage.applicationAccount.driver;
    const actualWorkerName = usage.actualDriver ? `${usage.actualDriver.actualName || usage.actualDriver.name} (${usage.actualDriver.internalCode})` : "";
    const actualWorkerIds = new Set(existing?.actualWorkerIds ?? []);
    const actualWorkers = new Set(existing?.actualWorkers ?? []);
    if (usage.actualDriverId) actualWorkerIds.add(usage.actualDriverId);
    if (actualWorkerName) actualWorkers.add(actualWorkerName);
    const riskLevel = accountUsageRisk({
      appName,
      ownerDriverId: usage.ownerDriverId || usage.applicationAccount.driver?.id || null,
      actualDriverIds: Array.from(actualWorkerIds),
      hasDailyData: Boolean(daily?.count),
      hasInvoice: Boolean(invoice?.count),
    });
    groups.set(key, {
      id: usage.id,
      month: usage.month,
      applicationName: appName || "-",
      applicationProjectName: usage.applicationProject?.name || "-",
      cityName: usage.city?.nameAr || usage.city?.nameEn || "-",
      appUserId: usage.applicationAccount.appUserId || usage.applicationAccount.username || "-",
      accountName: usage.applicationAccount.appUsername || usage.applicationAccount.username || "-",
      accountOwner: owner ? `${owner.actualName || owner.name} (${owner.internalCode})` : "-",
      actualWorkers: Array.from(actualWorkers),
      actualWorkerIds: Array.from(actualWorkerIds),
      dailyRecordsCount: daily?.count ?? 0,
      invoiceExists: Boolean(invoice?.count),
      completedOrders: (daily?.completed ?? 0) || (invoice?.completed ?? 0),
      actualWorkingHours: daily?.hours ?? 0,
      riskLevel,
      reviewReason: [usage.reviewReason, usage.usageType, usage.status].filter(Boolean).join(" | "),
      status: usage.status,
      applicationAccountId: usage.applicationAccountId,
    });
  }

  const accountIssueRows = accountIssues.map((account) => ({
    id: account.id,
    appName: account.appName,
    appUserId: account.appUserId,
    appUsername: account.appUsername,
    username: account.username,
    applicationName: account.application?.name ?? "",
    applicationProjectName: account.applicationProject?.name ?? "",
    cityName: account.city?.nameAr || account.city?.nameEn || "",
    driverName: account.driver ? `${account.driver.actualName || account.driver.name} (${account.driver.internalCode})` : "",
    needsReview: account.needsReview,
    unmatchedReason: account.unmatchedReason,
    status: account.status,
  }));

  const reviewRows = Array.from(groups.values()).sort((a, b) => {
    const weights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (weights[b.riskLevel] ?? 0) - (weights[a.riskLevel] ?? 0);
  });

  const readiness = {
    invoiceRecords: invoiceRows.length,
    dailyRecords: dailyRows.length,
    matchedAccounts: usages.filter((row) => row.applicationAccountId).length,
    matchedDrivers: usages.filter((row) => row.actualDriverId || row.ownerDriverId).length,
    missingActualWorkers: reviewRows.filter((row) => row.actualWorkers.length === 0).length,
    sharedAccountWarnings: reviewRows.filter((row) => row.riskLevel === "HIGH").length,
    criticalConflicts: reviewRows.filter((row) => row.riskLevel === "CRITICAL").length,
    invoiceWithoutDaily: Array.from(invoiceByKey.keys()).filter((key) => !dailyByKey.has(key)).length,
    dailyWithoutInvoice: Array.from(dailyByKey.keys()).filter((key) => !invoiceByKey.has(key)).length,
  };

  return {
    filters,
    options: { applications, projects, cities },
    accountIssueRows,
    reviewRows,
    readiness,
  };
}
