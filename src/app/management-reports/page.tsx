import { headers } from "next/headers";
import { PayrollStatus, Prisma, RecordStatus } from "@prisma/client";
import { ManagementReportsOldClient, type ManagementReportRow } from "@/components/reports/ManagementReportsOldClient";
import { getAccessScope } from "@/lib/auth/accessScope";
import { prisma } from "@/lib/prisma";
import { getCityRanking, getFilterOptions, getProjectPerformance, getRiderKpiReport, resolveEffectiveReportFilters, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function approvedStatusWhere() {
  return [
    { status: { in: [RecordStatus.APPROVED, RecordStatus.LOCKED] } },
    { invoiceStatus: { in: ["Approved", "Locked", "Paid", "APPROVED", "LOCKED", "PAID"] } },
  ];
}

function decimalNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(decimalNumber(value));
}

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function toneFromScore(score: number): "green" | "amber" | "red" | "blue" | "slate" {
  if (score >= 80) return "green";
  if (score >= 55) return "amber";
  return "red";
}

export default async function ManagementReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessScope = await getAccessScope(await headers());
  const options = await getFilterOptions(accessScope);
  const filters = await resolveEffectiveReportFilters({ ...resolveFilters(params, options), accessScope });

  const dateFrom = filters.dateFrom ? startOfDay(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? endOfDay(filters.dateTo) : undefined;

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    ...(filters.projectId ? { applicationProjectId: filters.projectId } : {}),
    ...(dateFrom || dateTo
      ? { issuedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
      : filters.month
        ? { month: filters.month }
        : {}),
    OR: approvedStatusWhere(),
  };
  const payrollWhere: Prisma.PayrollRunWhereInput = {
    ...(filters.projectId ? { applicationProjectId: filters.projectId } : {}),
    ...(filters.cityId ? { cityId: filters.cityId } : accessScope.isGlobal || !accessScope.cityIds.length ? {} : { cityId: { in: accessScope.cityIds } }),
    ...(filters.month ? { year: Number(filters.month.slice(0, 4)), month: Number(filters.month.slice(5, 7)) } : {}),
    status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED] },
  };
  const keetaAnd: Prisma.KeetaInvoiceRecordWhereInput[] = [];
  if (filters.projectId) keetaAnd.push({ applicationProjectId: filters.projectId });
  if (dateFrom || dateTo) {
    keetaAnd.push({
      OR: [
        { periodStart: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } },
        { approvedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } },
        { month: filters.month },
      ],
    });
  } else if (filters.month) {
    keetaAnd.push({ month: filters.month });
  }
  const keetaRevenueWhere: Prisma.KeetaInvoiceRecordWhereInput = {
    AND: keetaAnd,
    ...(filters.cityId ? { cityId: filters.cityId } : accessScope.isGlobal || !accessScope.cityIds.length ? {} : { cityId: { in: accessScope.cityIds } }),
    status: { in: ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID"] },
  };

  const [kpi, cityRows, projectRows, approvedInvoices, approvedKeetaRevenue, approvedPayroll] = await Promise.all([
    getRiderKpiReport(filters),
    getCityRanking(filters),
    getProjectPerformance(filters),
    prisma.invoice.aggregate({ where: invoiceWhere, _sum: { amount: true, vatAmount: true }, _count: { _all: true } }).catch(() => null),
    prisma.keetaInvoiceRecord.aggregate({ where: keetaRevenueWhere, _sum: { totalPayableAmount: true }, _count: { _all: true } }).catch(() => null),
    prisma.payrollRun.aggregate({ where: payrollWhere, _sum: { netTotal: true, totalEarnings: true, totalDeductions: true }, _count: { _all: true } }).catch(() => null),
  ]);

  const rows: ManagementReportRow[] = kpi.rows.map((row) => ({
    driverId: row.driverId,
    driverCode: row.driverCode,
    driverName: row.driverName,
    phone: row.phone,
    cityName: row.cityName,
    projectName: row.projectName,
    appName: row.appName,
    supervisorName: row.supervisorName,
    account: row.account,
    orders: row.orders,
    workingHours: row.workingHours,
    onTimeRate: row.onTimeRate,
    cancellationRate: row.cancellationRate,
    rejectionRate: row.rejectionRate,
    activeDays: row.activeDays,
    achievement: row.achievement,
    score: row.score,
    status: row.status,
    valid: row.valid,
    reasons: row.reasons,
    targetOrders: row.target.expectedOrders,
    targetHours: row.target.expectedWorkingHours,
    targetOnTime: row.target.onTimeRate,
    dailyReports: row.dailyReports,
  }));

  const invoicesTotal = decimalNumber(approvedInvoices?._sum.amount) + decimalNumber(approvedInvoices?._sum.vatAmount);
  const keetaRevenueTotal = decimalNumber(approvedKeetaRevenue?._sum.totalPayableAmount);
  const projectRevenueTotal = invoicesTotal + keetaRevenueTotal;
  const payrollTotal = decimalNumber(approvedPayroll?._sum.netTotal);
  const warningRows = rows.filter((row) => row.status === "WARNING").length;
  const criticalRows = rows.filter((row) => row.status === "CRITICAL").length;
  const alertsCount = rows.reduce((sum, row) => sum + row.reasons.length, 0);

  return (
    <ManagementReportsOldClient
      filters={filters}
      options={options}
      rows={rows}
      topCities={cityRows.slice(0, 6).map((row) => ({
        label: row.cityName,
        sub: `${row.appName} · طلبات ${row.orders}`,
        value: `${row.score}%`,
        tone: toneFromScore(row.score),
      }))}
      topProjects={projectRows.slice(0, 6).map((row) => ({
        label: row.projectName,
        sub: `${row.appName} · طلبات ${row.orders}`,
        value: `${row.score}%`,
        tone: toneFromScore(row.score),
      }))}
      summary={{
        totalRiders: rows.length,
        totalOrders: kpi.summary.totalOrders,
        totalHours: kpi.summary.totalHours,
        avgOnTime: kpi.summary.avgOnTime,
        avgCancellation: kpi.summary.avgCancellation,
        avgRejection: kpi.summary.avgRejection,
        avgKpi: average(rows.map((row) => row.score)),
        validRiders: kpi.summary.validRiders,
        invalidRiders: kpi.summary.invalidRiders,
        warningRows,
        criticalRows,
        alertsCount,
        approvedInvoices: approvedInvoices?._count._all ?? 0,
        approvedPayrolls: approvedPayroll?._count._all ?? 0,
        projectRevenue: money(projectRevenueTotal),
        payrollCost: money(payrollTotal),
        estimatedProfit: money(projectRevenueTotal - payrollTotal),
      }}
    />
  );
}
