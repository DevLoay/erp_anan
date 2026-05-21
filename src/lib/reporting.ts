import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { money } from "./format";

export type ReportFilters = {
  month: string;
  appName: string;
  cityId: string;
  projectId: string;
  supervisorId: string;
  q: string;
  status: string;
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

export async function getFilterOptions(): Promise<ReportFilterOptions> {
  const [monthRows, appRows, cities, projects, supervisors] = await Promise.all([
    prisma.dailyReport.findMany({ distinct: ["month"], select: { month: true }, orderBy: { month: "desc" } }).catch(() => []),
    prisma.dailyReport.findMany({ distinct: ["appName"], select: { appName: true }, where: { appName: { not: null } }, orderBy: { appName: "asc" } }).catch(() => []),
    prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }).catch(() => []),
    prisma.project.findMany({ select: { id: true, name: true, appName: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.supervisor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return {
    months: monthRows.map((row) => row.month).filter(Boolean),
    appNames: appRows.map((row) => row.appName ?? "").filter(Boolean),
    cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || city.id })),
    projects: projects.map((project) => ({ id: project.id, name: project.name, appName: project.appName ?? "" })),
    supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name })),
  };
}

export function resolveFilters(searchParams: Record<string, string | string[] | undefined>, options: ReportFilterOptions): ReportFilters {
  return {
    month: one(searchParams.month) || options.months[0] || "2026-04",
    appName: one(searchParams.appName),
    cityId: one(searchParams.cityId),
    projectId: one(searchParams.projectId),
    supervisorId: one(searchParams.supervisorId),
    q: one(searchParams.q),
    status: one(searchParams.status),
  };
}

function dailyReportWhere(filters: ReportFilters): Prisma.DailyReportWhereInput {
  const where: Prisma.DailyReportWhereInput = {};
  if (filters.month) where.month = filters.month;
  if (filters.appName) where.appName = filters.appName;
  if (filters.cityId) where.cityId = filters.cityId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.supervisorId) where.driver = { is: { supervisorId: filters.supervisorId } };
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
      appName: true,
      reportDate: true,
      month: true,
      orders: true,
      workingHours: true,
      onTimeRate: true,
      cancellationRate: true,
      rejectionRate: true,
      city: { select: { nameAr: true, nameEn: true } },
      project: { select: { name: true, appName: true } },
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

  const groups = new Map<string, { reports: typeof reports; days: Set<string> }>();
  for (const report of reports) {
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
    const appName = first.appName || driver?.project?.appName || first.project?.appName || "غير محدد";
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
    if (!driver?.projectId && !first.projectId) reasons.push("لا يوجد مشروع");

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
      projectId: driver?.projectId ?? first.projectId ?? "",
      projectName: driver?.project?.name ?? first.project?.name ?? "غير محدد",
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
    prisma.cityTarget.findMany({ where: { month: filters.month || undefined, appName: filters.appName || undefined } }).catch(() => []),
    prisma.applicationAccount.findMany({ select: { cityId: true, isEmpty: true, status: true, appName: true } }).catch(() => []),
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
