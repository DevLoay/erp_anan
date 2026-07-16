import { headers } from "next/headers";
import { RiderReportsOldClient, type RiderReportRow } from "@/components/rider-reports/RiderReportsOldClient";
import { getAccessScope } from "@/lib/auth/accessScope";
import { getFilterOptions, getRiderKpiReport, resolveFilters } from "@/lib/reporting";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
}

export default async function RiderReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const accessScope = await getAccessScope(await headers());
  const options = await getFilterOptions(accessScope);
  const filters = { ...resolveFilters(params, options), accessScope };
  const report = await getRiderKpiReport(filters);

  const rows: RiderReportRow[] = report.rows.map((row) => ({
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

  return (
    <RiderReportsOldClient
      filters={filters}
      options={options}
      rows={rows}
      summary={{
        totalRiders: rows.length,
        totalOrders: report.summary.totalOrders,
        totalHours: report.summary.totalHours,
        avgOnTime: report.summary.avgOnTime,
        avgCancellation: report.summary.avgCancellation,
        avgRejection: report.summary.avgRejection,
        avgKpi: average(rows.map((row) => row.score)),
        validRiders: report.summary.validRiders,
        invalidRiders: report.summary.invalidRiders,
        alertsCount: rows.reduce((sum, row) => sum + row.reasons.length, 0),
      }}
    />
  );
}
