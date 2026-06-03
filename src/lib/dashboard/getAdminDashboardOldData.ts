import { prisma } from "@/lib/prisma";

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

function performanceScore(report: { orders: number; workingHours: unknown; onTimeRate: unknown; cancellationRate: unknown; rejectionRate: unknown }) {
  const ordersScore = clamp((report.orders / 400) * 100);
  const hoursScore = clamp((toNumber(report.workingHours) / 10) * 100);
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
  take = 6,
): DashboardListRow[] {
  return items
    .map((item) => ({ id: getId(item), name: getName(item), kpi: getKpi(item), value: getValue(item), subtitle: getSubtitle(item) }))
    .sort((a, b) => b.kpi - a.kpi || b.value - a.value)
    .slice(0, take);
}

export async function getAdminDashboardOldData(filters: AdminDashboardFilters): Promise<AdminDashboardOldData> {
  try {
    const from = new Date(`${filters.fromDate}T00:00:00.000Z`);
    const to = new Date(`${filters.toDate}T23:59:59.999Z`);
    const q = filters.q.toLowerCase();

    const [drivers, supervisors, cities, projects, reports, tasks, notifications] = await Promise.all([
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
      prisma.project.findMany({ include: { drivers: true } }),
      prisma.dailyReport.findMany({
        where: { reportDate: { gte: from, lte: to } },
        include: { driver: { include: { city: true, project: true, supervisor: true } }, city: true, project: true },
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
            report.appName,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q)),
        )
      : reports;

    const driverStats = drivers.map((driver) => {
      const driverReports = filteredReports.filter((report) => report.driverId === driver.id);
      const orders = driverReports.reduce((sum, report) => sum + report.orders, 0);
      const kpi = avg(driverReports.map(performanceScore));
      const hasMissingScope = !driver.cityId || !driver.projectId || !driver.supervisorId;
      return {
        id: driver.id,
        name: driver.actualName || driver.name,
        cityName: driver.city?.nameAr || "-",
        projectName: driver.project?.name || "-",
        supervisorName: driver.supervisor?.name || "-",
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
        kpi: avg(cityReports.map(performanceScore)),
        count: city.drivers.length,
      };
    });

    const projectStats = projects.map((project) => {
      const projectReports = filteredReports.filter((report) => report.projectId === project.id || report.driver?.projectId === project.id);
      return {
        id: project.id,
        name: project.name,
        orders: projectReports.reduce((sum, report) => sum + report.orders, 0),
        kpi: avg(projectReports.map(performanceScore)),
        count: project.drivers.length,
      };
    });

    const supervisorStats = supervisors.map((supervisor) => {
      const supervisorReports = filteredReports.filter((report) => report.driver?.supervisorId === supervisor.id);
      return {
        id: supervisor.id,
        name: supervisor.name,
        orders: supervisorReports.reduce((sum, report) => sum + report.orders, 0),
        kpi: avg(supervisorReports.map(performanceScore)),
        count: supervisor.drivers.length,
      };
    });

    const bestDrivers = topRows(driverStats, (item) => item.id, (item) => item.name, (item) => item.kpi, (item) => item.orders, (item) => item.cityName);
    const bestCities = topRows(cityStats, (item) => item.id, (item) => item.name, (item) => item.kpi, (item) => item.orders, (item) => `${item.count} مندوب`);
    const bestProjects = topRows(projectStats, (item) => item.id, (item) => item.name, (item) => item.kpi, (item) => item.orders, (item) => `${item.count} مندوب`);
    const bestSupervisors = topRows(
      supervisorStats,
      (item) => item.id,
      (item) => item.name,
      (item) => item.kpi,
      (item) => item.count,
      (item) => `${item.orders} طلب`,
    );

    const totalOrders = filteredReports.reduce((sum, report) => sum + report.orders, 0);
    const averageKpi = avg(filteredReports.map(performanceScore));
    const needsFollowUp = driverStats.filter((driver) => driver.kpi < 70 || driver.hasMissingScope || driver.status !== "ACTIVE").length + tasks.length + notifications.length;

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
    };
  }
}
