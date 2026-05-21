import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { getCityRanking, getFilterOptions, getRiderKpiReport, resolveFilters, type CityRankingRow, type KpiRow, type ReportFilters } from "@/lib/reporting";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "الشهر الحالي";
  const [year, monthNumber] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(monthNumber) - 1] ?? monthNumber} ${year}`;
}

function monthFromDate(month: string, day: "start" | "end") {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  const date = day === "start" ? new Date(year, monthNumber - 1, 1) : new Date(year, monthNumber, 0);
  return date.toISOString().slice(0, 10);
}

function pct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    EXCELLENT: "Excellent",
    GOOD: "Good",
    AT_RISK: "At Risk",
    WEAK: "Weak",
    CRITICAL: "Critical",
    ACHIEVED: "Achieved",
    NOT_ACHIEVED: "Not Achieved",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    PENDING: "Pending",
  };
  return labels[status] ?? status;
}

function targetStatus(achievement: number) {
  if (achievement >= 100) return "Achieved";
  if (achievement >= 80) return "At Risk";
  return "Not Achieved";
}

function targetStatusCode(achievement: number) {
  if (achievement >= 100) return "ACHIEVED";
  if (achievement >= 80) return "AT_RISK";
  return "NOT_ACHIEVED";
}

function warningReasons(reasons: string[]) {
  const unique = [...new Set(reasons.filter(Boolean))];
  return unique.length ? unique.slice(0, 5) : ["طبيعي"];
}

function countRankingAlerts(row: CityRankingRow) {
  return [
    row.achievement < 80,
    row.onTimeRate < 95,
    row.cancellationRate > 0,
    row.rejectionRate > 0,
    row.invalidRiders > 0,
  ].filter(Boolean).length * Math.max(1, row.invalidRiders || 1);
}

function toDriverIssueRow(row: KpiRow): CityDriverIssueRow {
  return {
    cityId: row.cityId,
    appName: row.appName,
    driverId: row.driverId,
    driverCode: row.driverCode,
    driverName: row.driverName,
    phone: row.phone,
    supervisorName: row.supervisorName,
    projectName: row.projectName,
    account: row.account,
    orders: row.orders,
    workingHours: row.workingHours,
    onTimeRate: row.onTimeRate,
    cancellationRate: row.cancellationRate,
    rejectionRate: row.rejectionRate,
    achievement: row.achievement,
    score: row.score,
    valid: row.valid,
    reasons: row.reasons,
  };
}

function addGroupedStat<T extends { name: string; drivers: number; orders: number; invalidDrivers: number }>(map: Map<string, T>, key: string, seed: T, row: KpiRow) {
  const item = map.get(key) ?? seed;
  item.drivers += 1;
  item.orders += row.orders;
  if (!row.valid) item.invalidDrivers += 1;
  map.set(key, item);
}

export type CityPageFilters = ReportFilters & {
  fromDate: string;
  toDate: string;
  monthLabel: string;
};

export type CityPageOptions = {
  months: string[];
  appNames: string[];
  cities: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
};

export type CityOverviewRow = {
  cityId: string;
  cityName: string;
  status: string;
  totalDrivers: number;
  activeDrivers: number;
  inactiveDrivers: number;
  validDrivers: number;
  invalidDrivers: number;
  supervisors: number;
  applications: string[];
  orders: number;
  performance: number;
  alerts: number;
  updatedAt: string;
};

export type CityTargetOldRow = {
  cityId: string;
  cityName: string;
  appName: string;
  month: string;
  monthlyTarget: number;
  actualOrders: number;
  achievement: number;
  registeredDrivers: number;
  validDrivers: number;
  invalidDrivers: number;
  supervisors: number;
  reasons: string[];
  status: string;
  statusCode: string;
};

export type CityRankingOldRow = CityRankingRow & {
  alerts: number;
  evaluation: string;
};

export type CityDriverIssueRow = {
  cityId: string;
  appName: string;
  driverId: string;
  driverCode: string;
  driverName: string;
  phone: string;
  supervisorName: string;
  projectName: string;
  account: string;
  orders: number;
  workingHours: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  achievement: number;
  score: number;
  valid: boolean;
  reasons: string[];
};

export type CityDetailOldRow = {
  cityId: string;
  cityName: string;
  status: string;
  applications: string[];
  overview: CityOverviewRow;
  drivers: CityDriverIssueRow[];
  invalidDrivers: CityDriverIssueRow[];
  targets: CityTargetOldRow[];
  ranking: CityRankingOldRow[];
  supervisors: { name: string; drivers: number; orders: number; invalidDrivers: number }[];
  projects: { name: string; appName: string; drivers: number; orders: number; invalidDrivers: number }[];
  alerts: { title: string; severity: "critical" | "warning" | "info"; value: string; action: string }[];
};

export type CityOldPageData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: CityPageFilters;
  options: CityPageOptions;
  citiesRows: CityOverviewRow[];
  targetRows: CityTargetOldRow[];
  rankingRows: CityRankingOldRow[];
  cityDetails: CityDetailOldRow[];
  summary: {
    cities: {
      totalCities: number;
      totalDrivers: number;
      totalOrders: number;
      alerts: number;
    };
    targets: {
      targetRows: number;
      totalTarget: number;
      actualOrders: number;
      riskCities: number;
    };
    ranking: {
      rankingRows: number;
      totalOrders: number;
      avgAchievement: number;
      alerts: number;
    };
  };
};

export async function resolveCityPageFilters(params: SearchParams) {
  const options = await getFilterOptions();
  const reportFilters = resolveFilters(params, options);
  return {
    filters: {
      ...reportFilters,
      q: one(params, "q") || reportFilters.q,
      fromDate: one(params, "fromDate") || monthFromDate(reportFilters.month, "start"),
      toDate: one(params, "toDate") || monthFromDate(reportFilters.month, "end"),
      monthLabel: monthLabel(reportFilters.month),
    },
    options: {
      months: options.months.length ? options.months : [reportFilters.month],
      appNames: options.appNames,
      cities: options.cities,
      supervisors: options.supervisors,
    },
  };
}

export async function getCityOldPagesData(filters: CityPageFilters, options: CityPageOptions): Promise<CityOldPageData> {
  try {
    const reportFilters: ReportFilters = {
      month: filters.month,
      appName: filters.appName,
      cityId: filters.cityId,
      projectId: filters.projectId,
      supervisorId: filters.supervisorId,
      q: filters.q,
      status: filters.status,
    };

    const [{ rows: kpiRows }, rankingRows, cities, cityTargets, accounts] = await Promise.all([
      getRiderKpiReport({ ...reportFilters, status: "" }),
      getCityRanking(reportFilters),
      prisma.city.findMany({
        where: filters.cityId ? { id: filters.cityId } : {},
        orderBy: { nameAr: "asc" },
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          status: true,
          updatedAt: true,
          supervisors: { select: { id: true } },
          drivers: {
            select: {
              id: true,
              status: true,
              project: { select: { appName: true, name: true } },
              applicationAccounts: { select: { appName: true, application: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.cityTarget.findMany({
        where: {
          month: filters.month || undefined,
          appName: filters.appName || undefined,
          cityId: filters.cityId || undefined,
        },
        orderBy: [{ month: "desc" }, { appName: "asc" }],
      }),
      prisma.applicationAccount.findMany({
        where: {
          cityId: filters.cityId || undefined,
          appName: filters.appName || undefined,
        },
        select: { cityId: true, appName: true, isEmpty: true },
      }),
    ]);

    const rankingByCity = new Map<string, CityRankingRow[]>();
    for (const row of rankingRows) {
      rankingByCity.set(row.cityId, [...(rankingByCity.get(row.cityId) ?? []), row]);
    }

    const kpiByCityApp = new Map<string, typeof kpiRows>();
    const kpiByCity = new Map<string, typeof kpiRows>();
    for (const row of kpiRows) {
      const cityAppKey = `${row.cityId}:${row.appName}`;
      kpiByCityApp.set(cityAppKey, [...(kpiByCityApp.get(cityAppKey) ?? []), row]);
      kpiByCity.set(row.cityId, [...(kpiByCity.get(row.cityId) ?? []), row]);
    }

    const accountAppsByCity = new Map<string, Set<string>>();
    for (const account of accounts) {
      if (!account.cityId || !account.appName) continue;
      const set = accountAppsByCity.get(account.cityId) ?? new Set<string>();
      set.add(account.appName);
      accountAppsByCity.set(account.cityId, set);
    }

    const q = filters.q.trim().toLowerCase();
    const citiesRows = cities
      .map<CityOverviewRow>((city) => {
        const cityName = city.nameAr || city.nameEn || city.id;
        const cityKpi = kpiByCity.get(city.id) ?? [];
        const cityRanking = rankingByCity.get(city.id) ?? [];
        const driverApps = city.drivers.flatMap((driver) => [
          driver.project?.appName,
          driver.project?.name,
          ...driver.applicationAccounts.map((account) => account.application?.name || account.appName),
        ]);
        const apps = [...new Set([...driverApps, ...(accountAppsByCity.get(city.id) ?? [])].filter(Boolean) as string[])];
        const totalDrivers = city.drivers.length;
        const activeDrivers = city.drivers.filter((driver) => String(driver.status) === "ACTIVE").length;
        const orders = cityKpi.reduce((sum, row) => sum + row.orders, 0);
        const performance = cityRanking.length ? pct(cityRanking.reduce((sum, row) => sum + row.achievement, 0) / cityRanking.length) : 0;

        return {
          cityId: city.id,
          cityName,
          status: statusLabel(String(city.status)),
          totalDrivers,
          activeDrivers,
          inactiveDrivers: totalDrivers - activeDrivers,
          validDrivers: cityKpi.filter((row) => row.valid).length,
          invalidDrivers: cityKpi.filter((row) => !row.valid).length,
          supervisors: city.supervisors.length,
          applications: apps,
          orders,
          performance,
          alerts: cityRanking.reduce((sum, row) => sum + countRankingAlerts(row), 0) + cityKpi.filter((row) => !row.valid).length,
          updatedAt: city.updatedAt.toISOString(),
        };
      })
      .filter((row) => !q || [row.cityName, row.status, row.applications.join(" ")].join(" ").toLowerCase().includes(q));

    const cityNameById = new Map(cities.map((city) => [city.id, city.nameAr || city.nameEn || city.id]));
    const targetRows = cityTargets
      .map<CityTargetOldRow>((target) => {
        const rows = kpiByCityApp.get(`${target.cityId}:${target.appName ?? ""}`) ?? kpiByCity.get(target.cityId) ?? [];
        const actualOrders = rows.reduce((sum, row) => sum + row.orders, 0);
        const achievement = target.monthlyTarget ? pct((actualOrders / target.monthlyTarget) * 100) : 0;
        const status = targetStatus(achievement);
        return {
          cityId: target.cityId,
          cityName: cityNameById.get(target.cityId) || target.cityId,
          appName: target.appName || "-",
          month: target.month,
          monthlyTarget: target.monthlyTarget,
          actualOrders,
          achievement,
          registeredDrivers: rows.length,
          validDrivers: rows.filter((row) => row.valid).length,
          invalidDrivers: rows.filter((row) => !row.valid).length,
          supervisors: new Set(rows.map((row) => row.supervisorId).filter(Boolean)).size,
          reasons: warningReasons(rows.flatMap((row) => row.reasons)),
          status,
          statusCode: targetStatusCode(achievement),
        };
      })
      .filter((row) => !q || [row.cityName, row.appName, row.status, row.reasons.join(" ")].join(" ").toLowerCase().includes(q));

    const ranking = rankingRows
      .map<CityRankingOldRow>((row) => ({
        ...row,
        alerts: countRankingAlerts(row),
        evaluation: statusLabel(row.status),
      }))
      .filter((row) => !q || [row.cityName, row.appName, row.evaluation].join(" ").toLowerCase().includes(q));

    const cityDetails = citiesRows.map<CityDetailOldRow>((city) => {
      const cityKpi = (kpiByCity.get(city.cityId) ?? []).map(toDriverIssueRow);
      const invalidDrivers = cityKpi.filter((driver) => !driver.valid);
      const cityTargetsRows = targetRows.filter((target) => target.cityId === city.cityId);
      const cityRankingRows = ranking.filter((row) => row.cityId === city.cityId);

      const supervisorMap = new Map<string, { name: string; drivers: number; orders: number; invalidDrivers: number }>();
      const projectMap = new Map<string, { name: string; appName: string; drivers: number; orders: number; invalidDrivers: number }>();
      for (const row of kpiByCity.get(city.cityId) ?? []) {
        addGroupedStat(supervisorMap, row.supervisorName || "-", { name: row.supervisorName || "-", drivers: 0, orders: 0, invalidDrivers: 0 }, row);
        const projectKey = `${row.projectName}:${row.appName}`;
        const projectItem = projectMap.get(projectKey) ?? { name: row.projectName || "-", appName: row.appName || "-", drivers: 0, orders: 0, invalidDrivers: 0 };
        projectItem.drivers += 1;
        projectItem.orders += row.orders;
        if (!row.valid) projectItem.invalidDrivers += 1;
        projectMap.set(projectKey, projectItem);
      }

      const alerts: CityDetailOldRow["alerts"] = [
        ...cityTargetsRows
          .filter((target) => target.statusCode !== "ACHIEVED")
          .map((target) => ({
            title: `${target.cityName} - ${target.appName} أقل من التارجت`,
            severity: target.achievement < 80 ? "critical" as const : "warning" as const,
            value: `${pct(target.achievement)}%`,
            action: "مراجعة التارجت والمناديب غير المؤهلين",
          })),
        ...cityRankingRows
          .filter((row) => row.alerts > 0)
          .map((row) => ({
            title: `${row.cityName} - ${row.appName} لديها تنبيهات أداء`,
            severity: row.status === "CRITICAL" || row.status === "WEAK" ? "critical" as const : "warning" as const,
            value: `${row.alerts}`,
            action: "فتح تفاصيل الترتيب ومراجعة مؤشرات الأداء",
          })),
        ...invalidDrivers.slice(0, 8).map((driver) => ({
          title: `${driver.driverName} غير مؤهل`,
          severity: driver.score < 55 ? "critical" as const : "warning" as const,
          value: `${driver.score}%`,
          action: driver.reasons.slice(0, 2).join("، ") || "مراجعة بيانات المندوب",
        })),
      ];

      return {
        cityId: city.cityId,
        cityName: city.cityName,
        status: city.status,
        applications: city.applications,
        overview: city,
        drivers: cityKpi,
        invalidDrivers,
        targets: cityTargetsRows,
        ranking: cityRankingRows,
        supervisors: [...supervisorMap.values()].sort((a, b) => b.orders - a.orders),
        projects: [...projectMap.values()].sort((a, b) => b.orders - a.orders),
        alerts,
      };
    });

    return {
      databaseStatus: "online",
      filters,
      options,
      citiesRows,
      targetRows,
      rankingRows: ranking,
      cityDetails,
      summary: {
        cities: {
          totalCities: citiesRows.length,
          totalDrivers: citiesRows.reduce((sum, row) => sum + row.totalDrivers, 0),
          totalOrders: citiesRows.reduce((sum, row) => sum + row.orders, 0),
          alerts: citiesRows.reduce((sum, row) => sum + row.alerts, 0),
        },
        targets: {
          targetRows: targetRows.length,
          totalTarget: targetRows.reduce((sum, row) => sum + row.monthlyTarget, 0),
          actualOrders: targetRows.reduce((sum, row) => sum + row.actualOrders, 0),
          riskCities: targetRows.filter((row) => row.statusCode !== "ACHIEVED").length,
        },
        ranking: {
          rankingRows: ranking.length,
          totalOrders: ranking.reduce((sum, row) => sum + row.orders, 0),
          avgAchievement: ranking.length ? pct(ranking.reduce((sum, row) => sum + row.achievement, 0) / ranking.length) : 0,
          alerts: ranking.reduce((sum, row) => sum + row.alerts, 0),
        },
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error) || "تعذر تحميل بيانات المدن حالياً.";
    return {
      databaseStatus: "offline",
      databaseMessage: message,
      filters,
      options,
      citiesRows: [],
      targetRows: [],
      rankingRows: [],
      cityDetails: [],
      summary: {
        cities: { totalCities: 0, totalDrivers: 0, totalOrders: 0, alerts: 0 },
        targets: { targetRows: 0, totalTarget: 0, actualOrders: 0, riskCities: 0 },
        ranking: { rankingRows: 0, totalOrders: 0, avgAchievement: 0, alerts: 0 },
      },
    };
  }
}
