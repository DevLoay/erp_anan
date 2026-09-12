import { prisma } from "@/lib/prisma";
import { calculateExpectedTarget, calculatePerformancePercentage } from "@/lib/performance/expectedTargets";
import { DAILY_MINIMUM_ORDERS, getDailyPerformanceStatus } from "@/lib/performance/dailyPerformance";
import { displayCurrentEstimatedLevel } from "@/lib/performance/driverLevel";
import { getRulesForApp, getSystemRules } from "@/lib/reporting";

type SearchParams = Record<string, string | string[] | undefined>;

export type AdminDashboardFilters = {
  q: string;
  fromDate: string;
  toDate: string;
};

export type DashboardListRow = {
  id: string;
  name: string;
  kpi: number;
  value: number;
  subtitle: string;
  href: string;
};

export type DashboardChartRow = {
  id: string;
  name: string;
  value: number;
  kpi?: number;
  subtitle?: string;
  href: string;
};

export type AdminDashboardOldData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: AdminDashboardFilters;
  summary: {
    totalDrivers: number;
    activeDrivers: number;
    totalOrders: number;
    averageKpi: number;
    supervisors: number;
    needsFollowUp: number;
    bestCity: { name: string; kpi: number };
    bestDriver: { name: string; kpi: number };
    bestProject: { name: string; kpi: number };
    bestSupervisor: { name: string; kpi: number };
  };
  quickActions: DashboardChartRow[];
  charts: {
    dailyOrders: DashboardChartRow[];
    cityOrders: DashboardChartRow[];
    projectKpis: DashboardChartRow[];
    applicationOrders: DashboardChartRow[];
    followUpMix: DashboardChartRow[];
  };
  lists: {
    bestDrivers: DashboardListRow[];
    bestSupervisors: DashboardListRow[];
    bestCities: DashboardListRow[];
    bestProjects: DashboardListRow[];
  };
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return isoDate(date);
}

export async function resolveAdminDashboardFilters(searchParams: SearchParams): Promise<AdminDashboardFilters> {
  return {
    q: first(searchParams.q).trim(),
    fromDate: first(searchParams.fromDate) || defaultFromDate(),
    toDate: first(searchParams.toDate) || isoDate(new Date()),
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: unknown) {
  const numeric = toNumber(value);
  return numeric <= 1 && numeric > 0 ? numeric * 100 : numeric;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
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
  return raw || "Keeta";
}

function performanceScore(
  report: { orders: number; workingHours: unknown; onTimeRate: unknown; cancellationRate: unknown; rejectionRate: unknown; reportDate?: Date; month?: string | null },
  rules: { monthlyOrders: number; workingHours: number },
) {
  const reportDay = report.reportDate ? isoDate(report.reportDate) : isoDate(new Date());
  const reportMonth = report.month || reportDay.slice(0, 7);
  const dailyStatus = getDailyPerformanceStatus({ orders: report.orders, minimumOrders: DAILY_MINIMUM_ORDERS, hints: { workingHours: report.workingHours } });
  const expectedOrders = dailyStatus.shouldEvaluate ? DAILY_MINIMUM_ORDERS : 0;
  const expectedHours = calculateExpectedTarget({
    monthlyTarget: rules.workingHours,
    month: reportMonth,
    dateFrom: reportDay,
    dateTo: reportDay,
    precision: "decimal",
  }).expected;
  const ordersScore = clamp(calculatePerformancePercentage(report.orders, expectedOrders));
  const hoursScore = clamp(calculatePerformancePercentage(toNumber(report.workingHours), expectedHours));
  const onTimeScore = clamp(percent(report.onTimeRate));
  const cancellationScore = clamp(100 - percent(report.cancellationRate) * 10);
  const rejectionScore = clamp(100 - percent(report.rejectionRate) * 5);
  return Math.round((ordersScore + hoursScore + onTimeScore + cancellationScore + rejectionScore) / 5);
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function topRows<T>(
  items: T[],
  getId: (item: T) => string,
  getName: (item: T) => string,
  getKpi: (item: T) => number,
  getValue: (item: T) => number,
  getSubtitle: (item: T) => string,
  getHref: (item: T) => string,
  take = 6,
): DashboardListRow[] {
  return items
    .map((item) => ({ id: getId(item), name: getName(item), kpi: getKpi(item), value: getValue(item), subtitle: getSubtitle(item), href: getHref(item) }))
    .sort((a, b) => b.kpi - a.kpi || b.value - a.value)
    .slice(0, take);
}

function buildQuery(pathname: string, params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function dayKey(date: Date) {
  return isoDate(date);
}

function dayLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export async function getAdminDashboardOldData(filters: AdminDashboardFilters): Promise<AdminDashboardOldData> {
  try {
    const from = new Date(`${filters.fromDate}T00:00:00.000Z`);
    const to = new Date(`${filters.toDate}T23:59:59.999Z`);
    const q = filters.q.toLowerCase();
    const kpiSettings = await getSystemRules();

    const [drivers, supervisors, cities, applicationProjects, reports, tasks, notifications] = await Promise.all([
      prisma.driver.findMany({
        include: {
          city: true,
          project: true,
          supervisor: true,
          reports: { where: { reportDate: { gte: from, lte: to } } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.supervisor.findMany({ include: { city: true, drivers: true } }),
      prisma.city.findMany({ include: { drivers: true } }),
      prisma.applicationProject.findMany({ include: { application: true, city: true, accounts: true } }),
      prisma.dailyReport.findMany({
        where: { reportDate: { gte: from, lte: to } },
        include: {
          driver: { include: { city: true, project: true, supervisor: true } },
          city: true,
          project: true,
          applicationProject: { include: { application: true } },
        },
      }),
      prisma.task.findMany({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.notification.findMany({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    const filteredReports = q
      ? reports.filter((report) =>
          [
            report.driver?.name,
            report.driver?.actualName,
            report.driver?.internalCode,
            report.driver?.city?.nameAr,
            report.city?.nameAr,
            report.driver?.project?.name,
            report.project?.name,
            report.driver?.supervisor?.name,
            report.driver?.currentEstimatedLevel,
            report.appName,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q)),
        )
      : reports;

    const scoreReport = (report: (typeof filteredReports)[number]) => {
      const appName = appDisplayName(report.applicationProject?.application?.name || report.appName || report.project?.appName || report.driver?.project?.appName);
      return performanceScore(report, getRulesForApp(appName, kpiSettings));
    };

    const driverStats = drivers.map((driver) => {
      const driverReports = filteredReports.filter((report) => report.driverId === driver.id);
      const orders = driverReports.reduce((sum, report) => sum + report.orders, 0);
      const kpi = avg(driverReports.map(scoreReport));
      const hasMissingScope = !driver.cityId || !driver.projectId || !driver.supervisorId;
      return {
        id: driver.id,
        name: driver.actualName || driver.name,
        cityName: driver.city?.nameAr || "-",
        projectName: driver.project?.name || "-",
        supervisorName: driver.supervisor?.name || "-",
        currentEstimatedLevel: displayCurrentEstimatedLevel(driver.currentEstimatedLevel),
        orders,
        kpi,
        hasMissingScope,
        status: driver.status,
      };
    });

    const cityStats = cities.map((city) => {
      const cityReports = filteredReports.filter((report) => report.cityId === city.id || report.driver?.cityId === city.id);
      return {
        id: city.id,
        name: city.nameAr || city.nameEn || "-",
        orders: cityReports.reduce((sum, report) => sum + report.orders, 0),
        kpi: avg(cityReports.map(scoreReport)),
        count: city.drivers.length,
      };
    });

    const projectStats = applicationProjects.map((project) => {
      const projectReports = filteredReports.filter((report) => report.applicationProjectId === project.id);
      const driverCount = new Set(project.accounts.map((account) => account.driverId).filter(Boolean)).size;
      return {
        id: project.id,
        name: project.name || [project.application.name, project.city?.nameAr || project.city?.nameEn].filter(Boolean).join(" - "),
        orders: projectReports.reduce((sum, report) => sum + report.orders, 0),
        kpi: avg(projectReports.map(scoreReport)),
        count: driverCount,
      };
    });

    const supervisorStats = supervisors.map((supervisor) => {
      const supervisorReports = filteredReports.filter((report) => report.driver?.supervisorId === supervisor.id);
      return {
        id: supervisor.id,
        name: supervisor.name,
        orders: supervisorReports.reduce((sum, report) => sum + report.orders, 0),
        kpi: avg(supervisorReports.map(scoreReport)),
        count: supervisor.drivers.length,
      };
    });

    const bestDrivers = topRows(
      driverStats,
      (item) => item.id,
      (item) => item.name,
      (item) => item.kpi,
      (item) => item.orders,
      (item) => `${item.cityName} · Level ${item.currentEstimatedLevel}`,
      (item) => `/drivers/${item.id}`,
    );
    const bestCities = topRows(
      cityStats,
      (item) => item.id,
      (item) => item.name,
      (item) => item.kpi,
      (item) => item.orders,
      (item) => `${item.count} مندوب`,
      (item) => buildQuery("/management-reports", { cityId: item.id, dateFrom: filters.fromDate, dateTo: filters.toDate }),
    );
    const bestProjects = topRows(
      projectStats,
      (item) => item.id,
      (item) => item.name,
      (item) => item.kpi,
      (item) => item.orders,
      (item) => `${item.count} مندوب`,
      (item) => `/projects/${item.id}/dashboard`,
    );
    const bestSupervisors = topRows(
      supervisorStats,
      (item) => item.id,
      (item) => item.name,
      (item) => item.kpi,
      (item) => item.count,
      (item) => `${item.orders} طلب`,
      (item) => buildQuery("/drivers", { supervisorId: item.id }),
    );

    const totalOrders = filteredReports.reduce((sum, report) => sum + report.orders, 0);
    const averageKpi = avg(filteredReports.map(scoreReport));
    const needsFollowUp = driverStats.filter((driver) => driver.kpi < 70 || driver.hasMissingScope || driver.status !== "ACTIVE").length + tasks.length + notifications.length;
    const dailyOrderMap = filteredReports.reduce((map, report) => {
      const key = dayKey(report.reportDate);
      map.set(key, (map.get(key) ?? 0) + report.orders);
      return map;
    }, new Map<string, number>());
    const applicationOrderMap = filteredReports.reduce((map, report) => {
      const appName = appDisplayName(report.applicationProject?.application?.name || report.appName || report.project?.appName || report.driver?.project?.appName);
      map.set(appName, (map.get(appName) ?? 0) + report.orders);
      return map;
    }, new Map<string, number>());
    const dailyOrders = Array.from(dailyOrderMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, value]) => ({
        id: date,
        name: dayLabel(date),
        value,
        subtitle: date,
        href: buildQuery("/daily-reports", { fromDate: date, toDate: date }),
      }));
    const applicationOrders = Array.from(applicationOrderMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        id: name,
        name,
        value,
        subtitle: "طلبات الفترة",
        href: buildQuery("/management-reports", { appName: name, dateFrom: filters.fromDate, dateTo: filters.toDate }),
      }));
    const cityOrders = cityStats
      .filter((item) => item.orders > 0)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name,
        value: item.orders,
        kpi: item.kpi,
        subtitle: `${item.count} مندوب`,
        href: buildQuery("/management-reports", { cityId: item.id, dateFrom: filters.fromDate, dateTo: filters.toDate }),
      }));
    const projectKpis = projectStats
      .filter((item) => item.kpi > 0 || item.orders > 0)
      .sort((a, b) => b.kpi - a.kpi || b.orders - a.orders)
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name,
        value: item.orders,
        kpi: item.kpi,
        subtitle: `${item.count} مندوب`,
        href: `/projects/${item.id}/dashboard`,
      }));
    const followUpMix = [
      { id: "drivers", name: "مناديب تحتاج متابعة", value: driverStats.filter((driver) => driver.kpi < 70 || driver.hasMissingScope || driver.status !== "ACTIVE").length, href: "/drivers", subtitle: "تشغيل" },
      { id: "tasks", name: "مهام معلقة", value: tasks.length, href: "/supervisor-tasks", subtitle: "مشرفين" },
      { id: "notifications", name: "تنبيهات", value: notifications.length, href: "/notifications", subtitle: "إشعارات" },
    ];
    const quickActions = [
      { id: "drivers", name: "إجمالي المناديب", value: drivers.length, href: "/drivers", subtitle: "فتح قائمة المناديب" },
      { id: "active-drivers", name: "المناديب النشطون", value: drivers.filter((driver) => driver.status === "ACTIVE").length, href: "/drivers?status=ACTIVE", subtitle: "فلتر النشطين" },
      { id: "orders", name: "طلبات الفترة", value: totalOrders, href: buildQuery("/daily-reports", { fromDate: filters.fromDate, toDate: filters.toDate }), subtitle: "فتح التقارير اليومية" },
      { id: "projects", name: "المشاريع", value: applicationProjects.length, href: "/projects", subtitle: "فتح المشاريع" },
      { id: "alerts", name: "تحتاج متابعة", value: needsFollowUp, href: "/operations-alerts", subtitle: "فتح التنبيهات" },
      { id: "payroll", name: "المسير", value: 0, href: "/payroll", subtitle: "فتح مسير الرواتب" },
    ];

    return {
      databaseStatus: "online",
      filters,
      summary: {
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter((driver) => driver.status === "ACTIVE").length,
        totalOrders,
        averageKpi,
        supervisors: supervisors.length,
        needsFollowUp,
        bestCity: { name: bestCities[0]?.name ?? "لا توجد بيانات", kpi: bestCities[0]?.kpi ?? 0 },
        bestDriver: { name: bestDrivers[0]?.name ?? "لا توجد بيانات", kpi: bestDrivers[0]?.kpi ?? 0 },
        bestProject: { name: bestProjects[0]?.name ?? "لا توجد بيانات", kpi: bestProjects[0]?.kpi ?? 0 },
        bestSupervisor: { name: bestSupervisors[0]?.name ?? "لا توجد بيانات", kpi: bestSupervisors[0]?.kpi ?? 0 },
      },
      lists: {
        bestDrivers,
        bestSupervisors,
        bestCities,
        bestProjects,
      },
      quickActions,
      charts: {
        dailyOrders,
        cityOrders,
        projectKpis,
        applicationOrders,
        followUpMix,
      },
    };
  } catch (error) {
    return {
      databaseStatus: "offline",
      databaseMessage: error instanceof Error ? error.message : "Database is not available",
      filters,
      summary: {
        totalDrivers: 0,
        activeDrivers: 0,
        totalOrders: 0,
        averageKpi: 0,
        supervisors: 0,
        needsFollowUp: 0,
        bestCity: { name: "لا توجد بيانات", kpi: 0 },
        bestDriver: { name: "لا توجد بيانات", kpi: 0 },
        bestProject: { name: "لا توجد بيانات", kpi: 0 },
        bestSupervisor: { name: "لا توجد بيانات", kpi: 0 },
      },
      lists: { bestDrivers: [], bestSupervisors: [], bestCities: [], bestProjects: [] },
      quickActions: [],
      charts: {
        dailyOrders: [],
        cityOrders: [],
        projectKpis: [],
        applicationOrders: [],
        followUpMix: [],
      },
    };
  }
}
