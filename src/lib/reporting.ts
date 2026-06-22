import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { money } from "./format";
import type { AccessScope } from "@/lib/auth/accessScope";

export type ReportFilters = {
  month: string;
  dateFrom: string;
  dateTo: string;
  appName: string;
  cityId: string;
  projectId: string;
  supervisorId: string;
  driverId: string;
  q: string;
  status: string;
  accessScope?: AccessScope;
  effectivePeriodLabel?: string;
};

export type ReportFilterOptions = {
  months: string[];
  appNames: string[];
  cities: { id: string; name: string }[];
  projects: { id: string; name: string; appName: string }[];
  supervisors: { id: string; name: string }[];
};

export type KpiRules = {
  monthlyOrders: number;
  dailyOrders: number;
  workingHours: number;
  onTimeRate: number;
  maxCancellationRate: number;
  maxRejectionRate: number;
  minActiveDays: number;
};

export type KpiRow = {
  driverId: string;
  driverCode: string;
  driverName: string;
  phone: string;
  cityId: string;
  cityName: string;
  projectId: string;
  projectName: string;
  appName: string;
  supervisorId: string;
  supervisorName: string;
  account: string;
  orders: number;
  workingHours: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  activeDays: number;
  achievement: number;
  score: number;
  status: "GOOD" | "WARNING" | "CRITICAL";
  valid: boolean;
  reasons: string[];
  target: KpiRules;
  dailyReports: {
    id: string;
    date: string;
    orders: number;
    workingHours: number;
    onTimeRate: number;
    cancellationRate: number;
    rejectionRate: number;
    warnings: string[];
  }[];
};

export type KpiSummary = {
  totalRiders: number;
  validRiders: number;
  invalidRiders: number;
  totalOrders: number;
  totalHours: number;
  avgOnTime: number;
  avgCancellation: number;
  avgRejection: number;
  good: number;
  warning: number;
  critical: number;
};

export type CityRankingRow = {
  rank: number;
  cityId: string;
  cityName: string;
  appName: string;
  riders: number;
  validRiders: number;
  invalidRiders: number;
  orders: number;
  workingHours: number;
  monthlyTarget: number;
  achievement: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  emptyAccounts: number;
  usedAccounts: number;
  score: number;
  status: "EXCELLENT" | "GOOD" | "AT_RISK" | "WEAK" | "CRITICAL";
};

export type ProjectPerformanceRow = {
  key: string;
  projectName: string;
  appName: string;
  riders: number;
  validRiders: number;
  invalidRiders: number;
  orders: number;
  workingHours: number;
  achievement: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  score: number;
};

const fallbackRules: KpiRules = {
  monthlyOrders: 450,
  dailyOrders: 15,
  workingHours: 180,
  onTimeRate: 90,
  maxCancellationRate: 5,
  maxRejectionRate: 10,
  minActiveDays: 22,
};

export const defaultRulesByProject: Record<string, KpiRules> = {
  Keeta: { monthlyOrders: 450, dailyOrders: 15, workingHours: 180, onTimeRate: 90, maxCancellationRate: 5, maxRejectionRate: 10, minActiveDays: 22 },
  HungerStation: { monthlyOrders: 380, dailyOrders: 13, workingHours: 170, onTimeRate: 88, maxCancellationRate: 6, maxRejectionRate: 12, minActiveDays: 21 },
  Talabat: { monthlyOrders: 400, dailyOrders: 14, workingHours: 175, onTimeRate: 89, maxCancellationRate: 6, maxRejectionRate: 11, minActiveDays: 21 },
  Ninja: { monthlyOrders: 360, dailyOrders: 12, workingHours: 165, onTimeRate: 88, maxCancellationRate: 7, maxRejectionRate: 12, minActiveDays: 20 },
  Toyou: { monthlyOrders: 360, dailyOrders: 12, workingHours: 165, onTimeRate: 88, maxCancellationRate: 7, maxRejectionRate: 12, minActiveDays: 20 },
  Jahez: { monthlyOrders: 390, dailyOrders: 13, workingHours: 170, onTimeRate: 89, maxCancellationRate: 6, maxRejectionRate: 11, minActiveDays: 21 },
};

export const defaultPayrollRules = {
  basicSalary: 2000,
  targetBonus: 300,
  extraOrderBonus: 2,
  vehicleRentDeduction: 500,
  housingDeduction: 300,
  lockAfterApproval: true,
};

function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function monthStart(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  return `${month}-01`;
}

export function monthEnd(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function monthFromDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 7);
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function systemValue(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeRules(value: unknown): KpiRules {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    monthlyOrders: numberValue(source.monthlyOrders) || fallbackRules.monthlyOrders,
    dailyOrders: numberValue(source.dailyOrders) || fallbackRules.dailyOrders,
    workingHours: numberValue(source.workingHours) || fallbackRules.workingHours,
    onTimeRate: numberValue(source.onTimeRate) || fallbackRules.onTimeRate,
    maxCancellationRate: numberValue(source.maxCancellationRate) || fallbackRules.maxCancellationRate,
    maxRejectionRate: numberValue(source.maxRejectionRate) || fallbackRules.maxRejectionRate,
    minActiveDays: numberValue(source.minActiveDays) || fallbackRules.minActiveDays,
  };
}

export async function getSystemRules() {
  const [kpiSetting, payrollSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "kpiTargets" } }).catch(() => null),
    prisma.systemSetting.findUnique({ where: { key: "payrollRules" } }).catch(() => null),
  ]);

  const kpiValue = systemValue(kpiSetting?.value);
  const projects = systemValue(kpiValue.projects as Prisma.JsonValue);

  return {
    kpiSettingId: kpiSetting?.id ?? "",
    payrollSettingId: payrollSetting?.id ?? "",
    kpiTargets: {
      default: normalizeRules(kpiValue.default),
      projects: Object.fromEntries(
        Object.entries({ ...defaultRulesByProject, ...projects }).map(([key, value]) => [key, normalizeRules(value)]),
      ),
    },
    payrollRules: { ...defaultPayrollRules, ...systemValue(payrollSetting?.value) },
  };
}

export function getRulesForApp(appName: string, settings: Awaited<ReturnType<typeof getSystemRules>>) {
  return settings.kpiTargets.projects[appName] ?? settings.kpiTargets.default ?? fallbackRules;
}

function scopeWhere(scope?: AccessScope): Prisma.DailyReportWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.DailyReportWhereInput[] = [];

  if (scope.driverId) and.push({ driverId: scope.driverId });
  if (scope.supervisorId) and.push({ driver: { is: { supervisorId: scope.supervisorId } } });
  if (scope.cityIds.length) and.push({ OR: [{ cityId: { in: scope.cityIds } }, { driver: { is: { cityId: { in: scope.cityIds } } } }] });
  if (scope.projectIds.length) {
    and.push({
      applicationProjectId: { in: scope.projectIds },
    });
  }

  if (!and.length) return { id: "__NO_ACCESS__" };
  return { AND: and };
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

export async function getFilterOptions(accessScope?: AccessScope): Promise<ReportFilterOptions> {
  const reportScopeWhere = scopeWhere(accessScope);
  const [monthRows, appRows, cities, projects, supervisors] = await Promise.all([
    prisma.dailyReport.findMany({ distinct: ["month"], select: { month: true }, where: reportScopeWhere, orderBy: { month: "desc" } }).catch(() => []),
    prisma.dailyReport.findMany({ distinct: ["appName"], select: { appName: true }, where: { AND: [reportScopeWhere, { appName: { not: null } }] }, orderBy: { appName: "asc" } }).catch(() => []),
    prisma.city.findMany({ where: scopedCityWhere(accessScope), select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }).catch(() => []),
    prisma.applicationProject.findMany({
      where: scopedApplicationProjectWhere(accessScope),
      select: { id: true, name: true, city: { select: { nameAr: true, nameEn: true } }, application: { select: { name: true } } },
      orderBy: [{ application: { name: "asc" } }, { name: "asc" }],
    }).catch(() => []),
    prisma.supervisor.findMany({ where: scopedSupervisorWhere(accessScope), select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return {
    months: monthRows.map((row) => row.month).filter(Boolean),
    appNames: appRows.map((row) => row.appName ?? "").filter(Boolean),
    cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || city.id })),
    projects: projects.map((project) => ({ id: project.id, name: project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim(), appName: project.application.name })),
    supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name })),
  };
}

export function resolveFilters(searchParams: Record<string, string | string[] | undefined>, options: ReportFilterOptions): ReportFilters {
  const month = one(searchParams.month) || options.months[0] || "2026-04";
  return {
    month,
    dateFrom: one(searchParams.dateFrom) || one(searchParams.fromDate) || monthStart(month),
    dateTo: one(searchParams.dateTo) || one(searchParams.toDate) || monthEnd(month),
    appName: one(searchParams.appName),
    cityId: one(searchParams.cityId),
    projectId: one(searchParams.projectId),
    supervisorId: one(searchParams.supervisorId),
    driverId: one(searchParams.driverId) || one(searchParams.riderId),
    q: one(searchParams.q),
    status: one(searchParams.status),
  };
}

const approvedTextStatuses = ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID", "Reviewed", "REVIEWED", "approved", "locked", "paid", "reviewed"];

function accessibleProjectWhere(filters: ReportFilters) {
  if (!filters.projectId) return {};
  const allowed =
    !filters.accessScope ||
    filters.accessScope.isGlobal ||
    !filters.accessScope.projectIds.length ||
    filters.accessScope.projectIds.includes(filters.projectId);
  return allowed ? { applicationProjectId: filters.projectId } : { id: "__NO_ACCESS__" };
}

function accessibleCityWhere(filters: ReportFilters) {
  if (filters.cityId) {
    const allowed =
      !filters.accessScope ||
      filters.accessScope.isGlobal ||
      !filters.accessScope.cityIds.length ||
      filters.accessScope.cityIds.includes(filters.cityId);
    return allowed ? { cityId: filters.cityId } : { id: "__NO_ACCESS__" };
  }
  if (filters.accessScope && !filters.accessScope.isGlobal && filters.accessScope.cityIds.length) {
    return { cityId: { in: filters.accessScope.cityIds } };
  }
  return {};
}

function keetaPerformanceWhere(filters: ReportFilters): Prisma.KeetaPerformanceRecordWhereInput {
  const and: Prisma.KeetaPerformanceRecordWhereInput[] = [];
  const projectWhere = accessibleProjectWhere(filters);
  const cityWhere = accessibleCityWhere(filters);
  if (Object.keys(projectWhere).length) and.push(projectWhere as Prisma.KeetaPerformanceRecordWhereInput);
  if (Object.keys(cityWhere).length) and.push(cityWhere as Prisma.KeetaPerformanceRecordWhereInput);
  if (filters.appName && !filters.appName.toLowerCase().includes("keeta")) and.push({ id: "__NO_ACCESS__" });
  if (filters.dateFrom || filters.dateTo) {
    and.push({
      reportDate: {
        ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
      },
    });
  } else if (filters.month) {
    and.push({ month: filters.month });
  }
  and.push({ status: { in: approvedTextStatuses } });
  return { AND: and.filter((item) => Object.keys(item).length) };
}

function keetaInvoiceWhere(filters: ReportFilters): Prisma.KeetaInvoiceRecordWhereInput {
  const and: Prisma.KeetaInvoiceRecordWhereInput[] = [];
  const projectWhere = accessibleProjectWhere(filters);
  const cityWhere = accessibleCityWhere(filters);
  if (Object.keys(projectWhere).length) and.push(projectWhere as Prisma.KeetaInvoiceRecordWhereInput);
  if (Object.keys(cityWhere).length) and.push(cityWhere as Prisma.KeetaInvoiceRecordWhereInput);
  if (filters.appName && !filters.appName.toLowerCase().includes("keeta")) and.push({ id: "__NO_ACCESS__" });
  if (filters.dateFrom || filters.dateTo) {
    and.push({
      OR: [
        { periodStart: { ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}) } },
        { approvedAt: { ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}) } },
        ...(filters.month ? [{ month: filters.month }] : []),
      ],
    });
  } else if (filters.month) {
    and.push({ month: filters.month });
  }
  and.push({ status: { in: approvedTextStatuses } });
  return { AND: and.filter((item) => Object.keys(item).length) };
}

export async function resolveEffectiveReportFilters(filters: ReportFilters): Promise<ReportFilters> {
  if (filters.q || filters.driverId || filters.status) return filters;

  const currentRows = await prisma.dailyReport.count({ where: dailyReportWhere(filters) }).catch(() => 0);
  if (currentRows > 0) return filters;

  const baseFilters = { ...filters, month: "", dateFrom: "", dateTo: "" };
  const [latestDaily, latestKeetaPerformance, latestKeetaInvoice] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: dailyReportWhere(baseFilters),
      select: { month: true, reportDate: true },
      orderBy: { reportDate: "desc" },
    }).catch(() => null),
    prisma.keetaPerformanceRecord.findFirst({
      where: keetaPerformanceWhere(baseFilters),
      select: { month: true, reportDate: true },
      orderBy: { reportDate: "desc" },
    }).catch(() => null),
    prisma.keetaInvoiceRecord.findFirst({
      where: keetaInvoiceWhere(baseFilters),
      select: { month: true, periodEnd: true, approvedAt: true },
      orderBy: [{ periodEnd: "desc" }, { approvedAt: "desc" }],
    }).catch(() => null),
  ]);

  const candidates = [
    latestDaily ? { month: latestDaily.month || monthFromDate(latestDaily.reportDate), date: latestDaily.reportDate } : null,
    latestKeetaPerformance ? { month: latestKeetaPerformance.month || monthFromDate(latestKeetaPerformance.reportDate), date: latestKeetaPerformance.reportDate } : null,
    latestKeetaInvoice ? { month: latestKeetaInvoice.month || monthFromDate(latestKeetaInvoice.periodEnd ?? latestKeetaInvoice.approvedAt), date: latestKeetaInvoice.periodEnd ?? latestKeetaInvoice.approvedAt ?? null } : null,
  ]
    .filter((item): item is { month: string; date: Date | null } => Boolean(item?.month))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const latest = candidates[0];
  if (!latest?.month || latest.month === filters.month) return filters;

  return {
    ...filters,
    month: latest.month,
    dateFrom: monthStart(latest.month),
    dateTo: monthEnd(latest.month),
    effectivePeriodLabel: `تم عرض آخر فترة بها بيانات معتمدة: ${latest.month}`,
  };
}

function dailyReportWhere(filters: ReportFilters): Prisma.DailyReportWhereInput {
  const and: Prisma.DailyReportWhereInput[] = [scopeWhere(filters.accessScope)];
  if (filters.dateFrom || filters.dateTo) {
    and.push({
      reportDate: {
        ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
      },
    });
  } else if (filters.month) {
    and.push({ month: filters.month });
  }
  if (filters.appName) and.push({ appName: filters.appName });
  if (filters.cityId) {
    const allowed = !filters.accessScope || filters.accessScope.isGlobal || !filters.accessScope.cityIds.length || filters.accessScope.cityIds.includes(filters.cityId);
    and.push(allowed ? { cityId: filters.cityId } : { id: "__NO_ACCESS__" });
  }
  if (filters.projectId) {
    const allowed = !filters.accessScope || filters.accessScope.isGlobal || !filters.accessScope.projectIds.length || filters.accessScope.projectIds.includes(filters.projectId);
    and.push(
      allowed
        ? { applicationProjectId: filters.projectId }
        : { id: "__NO_ACCESS__" },
    );
  }
  if (filters.supervisorId) {
    const allowed = !filters.accessScope || filters.accessScope.isGlobal || !filters.accessScope.supervisorId || filters.accessScope.supervisorId === filters.supervisorId;
    and.push(allowed ? { driver: { is: { supervisorId: filters.supervisorId } } } : { id: "__NO_ACCESS__" });
  }
  if (filters.driverId) {
    const allowed = !filters.accessScope || filters.accessScope.isGlobal || !filters.accessScope.driverId || filters.accessScope.driverId === filters.driverId;
    and.push(allowed ? { driverId: filters.driverId } : { id: "__NO_ACCESS__" });
  }
  const where: Prisma.DailyReportWhereInput = { AND: and.filter((item) => Object.keys(item).length) };
  return where;
}

function textMatch(row: KpiRow, q: string) {
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  return [row.driverCode, row.driverName, row.phone, row.cityName, row.projectName, row.appName, row.supervisorName, row.account]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function statusMatch(row: KpiRow, status: string) {
  if (!status) return true;
  if (status === "valid") return row.valid;
  if (status === "invalid") return !row.valid;
  return row.status.toLowerCase() === status.toLowerCase();
}

function rowStatus(score: number, valid: boolean): KpiRow["status"] {
  if (valid && score >= 75) return "GOOD";
  if (score >= 55) return "WARNING";
  return "CRITICAL";
}

function performanceStatus(score: number): CityRankingRow["status"] {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "AT_RISK";
  if (score >= 45) return "WEAK";
  return "CRITICAL";
}

function buildKpiSummary(rows: KpiRow[]): KpiSummary {
  const totalOrders = rows.reduce((sum, row) => sum + row.orders, 0);
  const totalHours = rows.reduce((sum, row) => sum + row.workingHours, 0);
  const count = rows.length || 1;

  return {
    totalRiders: rows.length,
    validRiders: rows.filter((row) => row.valid).length,
    invalidRiders: rows.filter((row) => !row.valid).length,
    totalOrders,
    totalHours: pct(totalHours),
    avgOnTime: pct(rows.reduce((sum, row) => sum + row.onTimeRate, 0) / count),
    avgCancellation: pct(rows.reduce((sum, row) => sum + row.cancellationRate, 0) / count),
    avgRejection: pct(rows.reduce((sum, row) => sum + row.rejectionRate, 0) / count),
    good: rows.filter((row) => row.status === "GOOD").length,
    warning: rows.filter((row) => row.status === "WARNING").length,
    critical: rows.filter((row) => row.status === "CRITICAL").length,
  };
}

export async function getRiderKpiReport(filters: ReportFilters) {
  const settings = await getSystemRules();
  const reports = await prisma.dailyReport.findMany({
    where: dailyReportWhere(filters),
    select: {
      id: true,
      driverId: true,
      cityId: true,
      projectId: true,
      applicationId: true,
      applicationProjectId: true,
      appName: true,
      reportDate: true,
      month: true,
      updatedAt: true,
      orders: true,
      workingHours: true,
      onTimeRate: true,
      cancellationRate: true,
      rejectionRate: true,
      city: { select: { nameAr: true, nameEn: true } },
      project: { select: { name: true, appName: true } },
      applicationProject: { select: { id: true, name: true, application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } } },
      driver: {
        select: {
          id: true,
          internalCode: true,
          name: true,
          phone: true,
          cityId: true,
          projectId: true,
          supervisorId: true,
          accountId: true,
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
          supervisor: { select: { name: true } },
          account: { select: { username: true, appName: true } },
        },
      },
    },
    orderBy: [{ month: "desc" }, { reportDate: "desc" }],
  });

  const uniqueReportsByDriverDay = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    const dayKey = report.reportDate.toISOString().slice(0, 10);
    const reportKey = [
      report.driverId ?? `unassigned:${report.id}`,
      report.applicationProjectId ?? report.projectId ?? report.appName ?? "",
      report.cityId ?? report.driver?.cityId ?? "",
      dayKey,
    ].join(":");
    const existing = uniqueReportsByDriverDay.get(reportKey);
    if (!existing || report.updatedAt.getTime() >= existing.updatedAt.getTime()) {
      uniqueReportsByDriverDay.set(reportKey, report);
    }
  }

  const uniqueReports = [...uniqueReportsByDriverDay.values()];
  const groups = new Map<string, { reports: typeof uniqueReports; days: Set<string> }>();
  for (const report of uniqueReports) {
    const key = report.driverId ?? `unassigned:${report.id}`;
    if (!groups.has(key)) groups.set(key, { reports: [], days: new Set<string>() });
    const bucket = groups.get(key);
    if (!bucket) continue;
    bucket.reports.push(report);
    bucket.days.add(report.reportDate.toISOString().slice(0, 10));
  }

  const rows = Array.from(groups.entries()).map(([driverId, bucket]) => {
    const first = bucket.reports[0];
    const driver = first.driver;
    const appName = first.applicationProject?.application.name || first.appName || "غير محدد";
    const target = getRulesForApp(appName, settings);
    const count = bucket.reports.length || 1;
    const orders = bucket.reports.reduce((sum, report) => sum + report.orders, 0);
    const workingHours = bucket.reports.reduce((sum, report) => sum + numberValue(report.workingHours), 0);
    const onTimeRate = bucket.reports.reduce((sum, report) => sum + numberValue(report.onTimeRate), 0) / count;
    const cancellationRate = bucket.reports.reduce((sum, report) => sum + numberValue(report.cancellationRate), 0) / count;
    const rejectionRate = bucket.reports.reduce((sum, report) => sum + numberValue(report.rejectionRate), 0) / count;
    const activeDays = bucket.days.size;
    const achievement = target.monthlyOrders ? Math.round((orders / target.monthlyOrders) * 1000) / 10 : 0;

    const reasons: string[] = [];
    if (orders < target.monthlyOrders) reasons.push("طلبات أقل من التارجت");
    if (workingHours < target.workingHours) reasons.push("ساعات عمل أقل من المطلوب");
    if (onTimeRate < target.onTimeRate) reasons.push("نسبة الالتزام منخفضة");
    if (cancellationRate > target.maxCancellationRate) reasons.push("نسبة الإلغاء مرتفعة");
    if (rejectionRate > target.maxRejectionRate) reasons.push("نسبة الرفض مرتفعة");
    if (activeDays < target.minActiveDays) reasons.push("أيام النشاط أقل من المطلوب");
    if (!driver?.accountId) reasons.push("لا يوجد حساب تطبيق");
    if (!driver?.supervisorId) reasons.push("لا يوجد مشرف");
    if (!driver?.cityId && !first.cityId) reasons.push("لا توجد مدينة");
    if (!first.applicationProjectId) reasons.push("لا يوجد مشروع تشغيل");

    const dailyTargetHours = target.minActiveDays ? target.workingHours / target.minActiveDays : 8;
    const dailyReports = bucket.reports
      .slice()
      .sort((a, b) => b.reportDate.getTime() - a.reportDate.getTime())
      .map((report) => {
        const reportOrders = numberValue(report.orders);
        const reportHours = numberValue(report.workingHours);
        const reportOnTime = numberValue(report.onTimeRate);
        const reportCancellation = numberValue(report.cancellationRate);
        const reportRejection = numberValue(report.rejectionRate);
        const reportWarnings: string[] = [];
        if (reportOrders < target.dailyOrders) reportWarnings.push("طلبات أقل من اليومي");
        if (reportHours < dailyTargetHours) reportWarnings.push("ساعات أقل من المطلوب");
        if (reportOnTime < target.onTimeRate) reportWarnings.push("On-Time منخفض");
        if (reportCancellation > target.maxCancellationRate) reportWarnings.push("إلغاء مرتفع");
        if (reportRejection > target.maxRejectionRate) reportWarnings.push("رفض مرتفع");
        return {
          id: report.id,
          date: report.reportDate.toISOString().slice(0, 10),
          orders: reportOrders,
          workingHours: pct(reportHours),
          onTimeRate: pct(reportOnTime),
          cancellationRate: pct(reportCancellation),
          rejectionRate: pct(reportRejection),
          warnings: reportWarnings,
        };
      });

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Math.min(orders / Math.max(target.monthlyOrders, 1), 1) * 45 +
            Math.min(workingHours / Math.max(target.workingHours, 1), 1) * 20 +
            Math.min(onTimeRate / Math.max(target.onTimeRate, 1), 1) * 20 +
            Math.max(0, 1 - cancellationRate / Math.max(target.maxCancellationRate * 2, 1)) * 7.5 +
            Math.max(0, 1 - rejectionRate / Math.max(target.maxRejectionRate * 2, 1)) * 7.5,
        ),
      ),
    );
    const valid = reasons.length === 0;

    return {
      driverId,
      driverCode: driver?.internalCode ?? "-",
      driverName: driver?.name ?? "مندوب غير مربوط",
      phone: driver?.phone ?? "-",
      cityId: driver?.cityId ?? first.cityId ?? "",
      cityName: driver?.city?.nameAr ?? first.city?.nameAr ?? "غير محدد",
      projectId: first.applicationProjectId ?? "",
      projectName: first.applicationProject?.name ?? "غير محدد",
      appName,
      supervisorId: driver?.supervisorId ?? "",
      supervisorName: driver?.supervisor?.name ?? "غير محدد",
      account: driver?.account?.username ?? "-",
      orders,
      workingHours: pct(workingHours),
      onTimeRate: pct(onTimeRate),
      cancellationRate: pct(cancellationRate),
      rejectionRate: pct(rejectionRate),
      activeDays,
      achievement,
      score,
      status: rowStatus(score, valid),
      valid,
      reasons,
      target,
      dailyReports,
    } satisfies KpiRow;
  });

  const filteredRows = rows.filter((row) => textMatch(row, filters.q)).filter((row) => statusMatch(row, filters.status));
  filteredRows.sort((a, b) => b.score - a.score || b.orders - a.orders);

  return {
    rows: filteredRows,
    summary: buildKpiSummary(filteredRows),
  };
}

export async function getCityRanking(filters: ReportFilters) {
  const [{ rows: kpiRows }, targetRows, accounts] = await Promise.all([
    getRiderKpiReport({ ...filters, status: "" }),
    prisma.cityTarget.findMany({
      where: {
        month: filters.month || undefined,
        appName: filters.appName || undefined,
        cityId: filters.accessScope && !filters.accessScope.isGlobal && filters.accessScope.cityIds.length ? { in: filters.accessScope.cityIds } : undefined,
      },
    }).catch(() => []),
    prisma.applicationAccount.findMany({
      where: {
        cityId: filters.accessScope && !filters.accessScope.isGlobal && filters.accessScope.cityIds.length ? { in: filters.accessScope.cityIds } : undefined,
      },
      select: { cityId: true, isEmpty: true, status: true, appName: true },
    }).catch(() => []),
  ]);

  const targetMap = new Map(targetRows.map((target) => [`${target.cityId}:${target.appName ?? ""}`, target.monthlyTarget]));
  const accountMap = new Map<string, { empty: number; used: number }>();
  for (const account of accounts) {
    if (filters.appName && account.appName !== filters.appName) continue;
    const key = `${account.cityId ?? ""}:${account.appName ?? ""}`;
    const item = accountMap.get(key) ?? { empty: 0, used: 0 };
    if (account.isEmpty) item.empty += 1;
    else item.used += 1;
    accountMap.set(key, item);
  }

  const groups = new Map<string, KpiRow[]>();
  for (const row of kpiRows) {
    const key = `${row.cityId}:${row.appName}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const rows = Array.from(groups.entries()).map(([key, riders]) => {
    const first = riders[0];
    const monthlyTarget =
      targetMap.get(`${first.cityId}:${first.appName}`) ??
      targetMap.get(`${first.cityId}:`) ??
      riders.reduce((sum, rider) => sum + rider.target.monthlyOrders, 0);
    const orders = riders.reduce((sum, rider) => sum + rider.orders, 0);
    const count = riders.length || 1;
    const score = Math.round(riders.reduce((sum, rider) => sum + rider.score, 0) / count);
    const accountStats = accountMap.get(key) ?? accountMap.get(`${first.cityId}:`) ?? { empty: 0, used: 0 };

    return {
      rank: 0,
      cityId: first.cityId,
      cityName: first.cityName,
      appName: first.appName,
      riders: riders.length,
      validRiders: riders.filter((rider) => rider.valid).length,
      invalidRiders: riders.filter((rider) => !rider.valid).length,
      orders,
      workingHours: pct(riders.reduce((sum, rider) => sum + rider.workingHours, 0)),
      monthlyTarget,
      achievement: monthlyTarget ? pct((orders / monthlyTarget) * 100) : 0,
      onTimeRate: pct(riders.reduce((sum, rider) => sum + rider.onTimeRate, 0) / count),
      cancellationRate: pct(riders.reduce((sum, rider) => sum + rider.cancellationRate, 0) / count),
      rejectionRate: pct(riders.reduce((sum, rider) => sum + rider.rejectionRate, 0) / count),
      emptyAccounts: accountStats.empty,
      usedAccounts: accountStats.used,
      score,
      status: performanceStatus(score),
    } satisfies CityRankingRow;
  });

  rows.sort((a, b) => b.score - a.score || b.achievement - a.achievement);
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getProjectPerformance(filters: ReportFilters) {
  const { rows: kpiRows } = await getRiderKpiReport({ ...filters, status: "" });
  const groups = new Map<string, KpiRow[]>();
  for (const row of kpiRows) {
    const key = `${row.projectId || row.projectName}:${row.appName}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const rows = Array.from(groups.entries()).map(([key, riders]) => {
    const first = riders[0];
    const count = riders.length || 1;
    const target = riders.reduce((sum, rider) => sum + rider.target.monthlyOrders, 0);
    const orders = riders.reduce((sum, rider) => sum + rider.orders, 0);
    return {
      key,
      projectName: first.projectName,
      appName: first.appName,
      riders: riders.length,
      validRiders: riders.filter((row) => row.valid).length,
      invalidRiders: riders.filter((row) => !row.valid).length,
      orders,
      workingHours: pct(riders.reduce((sum, row) => sum + row.workingHours, 0)),
      achievement: target ? pct((orders / target) * 100) : 0,
      onTimeRate: pct(riders.reduce((sum, row) => sum + row.onTimeRate, 0) / count),
      cancellationRate: pct(riders.reduce((sum, row) => sum + row.cancellationRate, 0) / count),
      rejectionRate: pct(riders.reduce((sum, row) => sum + row.rejectionRate, 0) / count),
      score: Math.round(riders.reduce((sum, row) => sum + row.score, 0) / count),
    } satisfies ProjectPerformanceRow;
  });

  return rows.sort((a, b) => b.score - a.score || b.orders - a.orders);
}

export async function getPayrollReadiness(month: string) {
  const [payrolls, advances, deductions] = await Promise.all([
    prisma.payroll.findMany({
      where: { month },
      select: { id: true, month: true, basicSalary: true, bonus: true, deductions: true, netSalary: true, status: true },
    }).catch(() => []),
    prisma.advance.aggregate({ where: { deductionMonth: month, status: "APPROVED" }, _sum: { amount: true, remainingAmount: true }, _count: true }).catch(() => null),
    prisma.deduction.aggregate({ where: { month }, _sum: { amount: true }, _count: true }).catch(() => null),
  ]);

  const net = payrolls.reduce((sum, row) => sum + numberValue(row.netSalary), 0);
  const basic = payrolls.reduce((sum, row) => sum + numberValue(row.basicSalary), 0);
  const payrollDeductions = payrolls.reduce((sum, row) => sum + numberValue(row.deductions), 0);

  return {
    count: payrolls.length,
    draft: payrolls.filter((row) => row.status === "DRAFT").length,
    underReview: payrolls.filter((row) => row.status === "UNDER_REVIEW").length,
    approved: payrolls.filter((row) => row.status === "APPROVED").length,
    paid: payrolls.filter((row) => row.status === "PAID").length,
    locked: payrolls.filter((row) => row.status === "LOCKED").length,
    basic: money(basic),
    payrollDeductions: money(payrollDeductions),
    net: money(net),
    approvedAdvances: advances?._count ?? 0,
    approvedAdvancesAmount: money(advances?._sum.amount ?? 0),
    deductionCount: deductions?._count ?? 0,
    deductionAmount: money(deductions?._sum.amount ?? 0),
  };
}
