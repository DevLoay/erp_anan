import { prisma } from "./prisma";
import { getCityRanking, getFilterOptions, getPayrollReadiness, getProjectPerformance, getRiderKpiReport, resolveFilters } from "./reporting";
import { money } from "./format";
import type { AnalyticsTone, ChartDatum, Insight, SmartAlert, TopListItem } from "@/components/analytics/types";

type Metric = {
  title: string;
  value: string | number;
  hint?: string;
  tone?: AnalyticsTone;
};

type ChartBlock = {
  type: "bar" | "line" | "pie";
  title: string;
  data: ChartDatum[];
};

type GaugeBlock = {
  title: string;
  value: number;
  target?: number;
  label?: string;
};

type ProgressBlock = {
  title: string;
  current: number;
  target: number;
  suffix?: string;
};

type TopListBlock = {
  title: string;
  items: TopListItem[];
};

export type PageAnalytics = {
  metrics: Metric[];
  gauges: GaugeBlock[];
  progress: ProgressBlock[];
  charts: ChartBlock[];
  topLists: TopListBlock[];
  alerts: SmartAlert[];
  insight?: Insight;
};

type DriverWithRelations = Awaited<ReturnType<typeof prisma.driver.findMany>>[number] & {
  city?: { nameAr: string | null; nameEn: string | null } | null;
  project?: { name: string; appName: string | null } | null;
  supervisor?: { name: string } | null;
};

const emptyAnalytics: PageAnalytics = {
  metrics: [],
  gauges: [],
  progress: [],
  charts: [],
  topLists: [],
  alerts: [],
};

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return pct(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function statusTone(value: number, good: number, warning: number, reverse = false): AnalyticsTone {
  if (reverse) {
    if (value <= good) return "emerald";
    if (value <= warning) return "amber";
    return "red";
  }
  if (value >= good) return "emerald";
  if (value >= warning) return "amber";
  return "red";
}

function groupSum<T>(rows: T[], keyFn: (row: T) => string, valueFn: (row: T) => number, limit = 8) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "غير محدد";
    map.set(key, (map.get(key) ?? 0) + valueFn(row));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function groupCount<T>(rows: T[], keyFn: (row: T) => string, limit = 8) {
  return groupSum(rows, keyFn, () => 1, limit);
}

function cityName(city?: { nameAr: string | null; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "غير محدد";
}

function projectName(project?: { name: string; appName: string | null } | null) {
  return project?.name || project?.appName || "غير محدد";
}

function pageInsight(page: string, analytics: PageAnalytics): Insight | undefined {
  const firstAlert = analytics.alerts[0];
  const firstTop = analytics.topLists[0]?.items[0];
  if (firstAlert) return { title: firstAlert.title, body: firstAlert.body, tone: firstAlert.severity === "critical" ? "red" : "amber" };
  if (firstTop) return { title: "أفضل مؤشر حالي", body: `${firstTop.label} هو الأعلى في ${analytics.topLists[0].title} بقيمة ${firstTop.value}.`, tone: "blue" };
  return { title: "لا توجد بيانات كافية", body: `لا توجد بيانات كافية لإظهار تحليل دقيق في صفحة ${page} حاليا.`, tone: "slate" };
}

async function baseData() {
  const options = await getFilterOptions();
  const filters = resolveFilters({}, options);
  const [
    drivers,
    supervisors,
    cities,
    projects,
    vehicles,
    accounts,
    reports,
    advances,
    deductions,
    violations,
    payrolls,
    invoices,
    expenses,
    revenues,
    importBatches,
    dataCleaningIssues,
    systemSettings,
  ] = await Promise.all([
    prisma.driver.findMany({
      select: {
        id: true,
        internalCode: true,
        name: true,
        phone: true,
        nationalId: true,
        cityId: true,
        projectId: true,
        supervisorId: true,
        vehicleId: true,
        accountId: true,
        status: true,
        contractType: true,
        housingStatus: true,
        createdAt: true,
        updatedAt: true,
        city: { select: { nameAr: true, nameEn: true } },
        project: { select: { name: true, appName: true } },
        supervisor: { select: { name: true } },
        account: { select: { username: true, appName: true } },
      },
    }),
    prisma.supervisor.findMany({ include: { city: true, drivers: { select: { id: true } } } }),
    prisma.city.findMany({ include: { drivers: { select: { id: true } }, supervisors: true, projects: true } }),
    prisma.project.findMany({ include: { city: true, drivers: { select: { id: true } } } }),
    prisma.vehicle.findMany({
      select: {
        id: true,
        plateAr: true,
        plateEn: true,
        model: true,
        rentalCompany: true,
        monthlyRent: true,
        status: true,
        currentDriverId: true,
        cityId: true,
        city: { select: { nameAr: true, nameEn: true } },
      },
    }),
    prisma.applicationAccount.findMany({
      select: { id: true, appName: true, username: true, projectId: true, cityId: true, driverId: true, isEmpty: true, status: true, project: { select: { name: true, appName: true } } },
    }),
    prisma.dailyReport.findMany({
      select: {
        id: true,
        reportDate: true,
        month: true,
        appName: true,
        orders: true,
        workingHours: true,
        onTimeRate: true,
        cancellationRate: true,
        rejectionRate: true,
        city: { select: { nameAr: true, nameEn: true } },
        project: { select: { name: true, appName: true } },
        driver: { select: { id: true, name: true, supervisorId: true, supervisor: { select: { name: true } } } },
      },
      orderBy: { reportDate: "asc" },
    }),
    prisma.advance.findMany({ select: { id: true, driverId: true, amount: true, remainingAmount: true, deductionMonth: true, status: true, driver: { select: { name: true } } } }),
    prisma.deduction.findMany({ select: { id: true, driverId: true, type: true, amount: true, month: true, status: true, driver: { select: { name: true } } } }),
    prisma.violation.findMany({ select: { id: true, driverId: true, type: true, amount: true, status: true, occurredAt: true, driver: { select: { name: true } } } }),
    prisma.payroll.findMany({
      select: {
        id: true,
        driverId: true,
        projectId: true,
        month: true,
        basicSalary: true,
        bonus: true,
        deductions: true,
        netSalary: true,
        status: true,
        driver: { select: { name: true, city: { select: { nameAr: true, nameEn: true } }, project: { select: { name: true, appName: true } } } },
        project: { select: { name: true, appName: true } },
      },
    }),
    prisma.invoice.findMany(),
    prisma.expense.findMany(),
    prisma.revenue.findMany(),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.dataCleaningIssue.findMany({ where: { status: { in: ["PENDING", "ACTIVE"] } } }),
    prisma.systemSetting.findMany(),
  ]);

  const [kpi, cityRanking, projectPerformance, payrollReadiness] = await Promise.all([
    getRiderKpiReport(filters),
    getCityRanking(filters),
    getProjectPerformance(filters),
    getPayrollReadiness(filters.month),
  ]);

  return {
    options,
    filters,
    drivers: drivers as unknown as DriverWithRelations[],
    supervisors,
    cities,
    projects,
    vehicles,
    accounts,
    reports,
    advances,
    deductions,
    violations,
    payrolls,
    invoices,
    expenses,
    revenues,
    importBatches,
    dataCleaningIssues,
    systemSettings,
    kpi,
    cityRanking,
    projectPerformance,
    payrollReadiness,
  };
}

function commonReportCharts(data: Awaited<ReturnType<typeof baseData>>) {
  return {
    ordersByCity: groupSum(data.reports, (row) => cityName(row.city), (row) => row.orders),
    ordersByProject: groupSum(data.reports, (row) => projectName(row.project), (row) => row.orders),
    ordersTrend: groupSum(data.reports, (row) => row.reportDate.toISOString().slice(0, 10), (row) => row.orders, 14).sort((a, b) => a.name.localeCompare(b.name)),
    ordersByApp: groupSum(data.reports, (row) => row.appName || row.project?.appName || "غير محدد", (row) => row.orders),
    hoursTrend: groupSum(data.reports, (row) => row.reportDate.toISOString().slice(0, 10), (row) => numberValue(row.workingHours), 14).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function dashboardAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const charts = commonReportCharts(data);
  const totalOrders = data.reports.reduce((sum, row) => sum + row.orders, 0);
  const collection = data.invoices.reduce((sum, row) => sum + numberValue(row.amount), 0) + data.revenues.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const advances = data.advances.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const deductions = data.deductions.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const payrollNet = data.payrolls.reduce((sum, row) => sum + numberValue(row.netSalary), 0);

  const alerts: SmartAlert[] = [
    data.kpi.summary.invalidRiders
      ? { title: "مناديب أقل من التارجت", body: `${data.kpi.summary.invalidRiders} مندوب يحتاج متابعة في الشهر الحالي.`, severity: "warning", href: "/rider-kpi?status=invalid" }
      : null,
    data.vehicles.filter((row) => row.status === "MAINTENANCE").length
      ? { title: "سيارات في الصيانة", body: `${data.vehicles.filter((row) => row.status === "MAINTENANCE").length} سيارة حاليا في الصيانة.`, severity: "warning", href: "/vehicles" }
      : null,
    data.vehicles.filter((row) => !row.currentDriverId).length
      ? { title: "سيارات بدون مندوب", body: `${data.vehicles.filter((row) => !row.currentDriverId).length} سيارة غير مرتبطة بمندوب.`, severity: "info", href: "/vehicles" }
      : null,
  ].filter(Boolean) as SmartAlert[];

  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي المناديب", value: data.drivers.length },
      { title: "المناديب النشطين", value: data.drivers.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "إجمالي المشرفين", value: data.supervisors.length },
      { title: "إجمالي المدن", value: data.cities.length },
      { title: "إجمالي المشاريع", value: data.projects.length },
      { title: "إجمالي السيارات", value: data.vehicles.length },
      { title: "إجمالي الطلبات", value: totalOrders, tone: statusTone(totalOrders, 400, 300) },
      { title: "إجمالي التحصيل", value: money(collection), tone: "blue" },
      { title: "إجمالي السلف", value: money(advances), tone: "amber" },
      { title: "إجمالي الخصومات", value: money(deductions), tone: "red" },
      { title: "صافي الرواتب المتوقعة", value: money(payrollNet), tone: payrollNet < 0 ? "red" : "emerald" },
    ],
    gauges: [{ title: "متوسط تحقيق التارجت", value: data.kpi.summary.totalRiders ? pct((data.kpi.summary.validRiders / data.kpi.summary.totalRiders) * 100) : 0 }],
    progress: [],
    charts: [
      { type: "bar", title: "Orders by City", data: charts.ordersByCity },
      { type: "bar", title: "Orders by Project", data: charts.ordersByProject },
      { type: "pie", title: "Drivers by Status", data: groupCount(data.drivers, (row) => row.status) },
      { type: "pie", title: "Vehicles by Status", data: groupCount(data.vehicles, (row) => row.status) },
      { type: "line", title: "Monthly Orders Trend", data: charts.ordersTrend },
      { type: "line", title: "Payroll Summary", data: groupSum(data.payrolls, (row) => row.month, (row) => numberValue(row.netSalary), 12).sort((a, b) => a.name.localeCompare(b.name)) },
    ],
    topLists: [
      { title: "أفضل 5 مدن حسب الطلبات", items: data.cityRanking.slice(0, 5).map((row) => ({ label: row.cityName, value: row.orders, sub: `${row.appName} - ${row.achievement}%` })) },
      { title: "أفضل 5 مشاريع", items: data.projectPerformance.slice(0, 5).map((row) => ({ label: row.projectName, value: row.orders, sub: `${row.appName} - ${row.score}%` })) },
      { title: "أفضل 10 مناديب", items: data.kpi.rows.slice(0, 10).map((row) => ({ label: row.driverName, value: row.orders, sub: `${row.cityName} - ${row.score}%` })) },
      { title: "أقل 5 مناديب أداء", items: [...data.kpi.rows].sort((a, b) => a.score - b.score).slice(0, 5).map((row) => ({ label: row.driverName, value: `${row.score}%`, sub: row.reasons.slice(0, 2).join("، ") })) },
    ],
    alerts,
  };
  analytics.insight = pageInsight("Dashboard", analytics);
  return analytics;
}

function driversAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const driverIdsWithDeductions = new Set(data.deductions.map((row) => row.driverId));
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي المناديب", value: data.drivers.length },
      { title: "النشطين", value: data.drivers.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "الموقوفين", value: data.drivers.filter((row) => row.status === "SUSPENDED").length, tone: "red" },
      { title: "بدون مشرف", value: data.drivers.filter((row) => !row.supervisorId).length, tone: "amber" },
      { title: "بدون سيارة", value: data.drivers.filter((row) => !row.vehicleId).length, tone: "blue" },
      { title: "بدون حساب تطبيق", value: data.drivers.filter((row) => !row.accountId).length, tone: "amber" },
      { title: "أقل من التارجت", value: data.kpi.summary.invalidRiders, tone: "red" },
      { title: "لديهم خصومات", value: driverIdsWithDeductions.size, tone: "orange" },
    ],
    gauges: [
      { title: "متوسط On Time", value: data.kpi.summary.avgOnTime, target: 99 },
      { title: "متوسط ساعات العمل", value: data.kpi.summary.totalRiders ? pct(data.kpi.summary.totalHours / data.kpi.summary.totalRiders) : 0, target: 10, label: "الهدف 10 ساعات" },
    ],
    progress: [],
    charts: [
      { type: "bar", title: "توزيع المناديب حسب المدينة", data: groupCount(data.drivers, (row) => cityName(row.city)) },
      { type: "bar", title: "توزيع المناديب حسب المشروع", data: groupCount(data.drivers, (row) => projectName(row.project)) },
      { type: "pie", title: "توزيع المناديب حسب الحالة", data: groupCount(data.drivers, (row) => row.status) },
      { type: "pie", title: "توزيع المناديب حسب نوع السكن", data: groupCount(data.drivers, (row) => row.housingStatus || "غير محدد") },
      { type: "pie", title: "توزيع المناديب حسب نوع العقد", data: groupCount(data.drivers, (row) => row.contractType || "غير محدد") },
    ],
    topLists: [
      { title: "أفضل 10 مناديب حسب الطلبات", items: data.kpi.rows.slice(0, 10).map((row) => ({ label: row.driverName, value: row.orders, sub: row.cityName })) },
      { title: "أقل 10 مناديب حسب الطلبات", items: [...data.kpi.rows].sort((a, b) => a.orders - b.orders).slice(0, 10).map((row) => ({ label: row.driverName, value: row.orders, sub: row.reasons.slice(0, 2).join("، ") })) },
      { title: "مناديب بدون سيارة", items: data.drivers.filter((row) => !row.vehicleId).slice(0, 10).map((row) => ({ label: row.name, value: row.internalCode, sub: cityName(row.city) })) },
      { title: "مناديب بدون مشروع", items: data.drivers.filter((row) => !row.projectId).slice(0, 10).map((row) => ({ label: row.name, value: row.internalCode, sub: cityName(row.city) })) },
    ],
    alerts: [
      data.drivers.filter((row) => !row.supervisorId).length ? { title: "مناديب بدون مشرف", body: "يوجد مناديب تحتاج ربط بمشرف لتفعيل نطاق المهام.", severity: "warning" } : null,
      data.kpi.summary.critical ? { title: "أداء حرج", body: `${data.kpi.summary.critical} مندوب في مستوى حرج حسب KPI.`, severity: "critical", href: "/rider-kpi?status=CRITICAL" } : null,
    ].filter(Boolean) as SmartAlert[],
  };
  analytics.insight = pageInsight("Drivers", analytics);
  return analytics;
}

function supervisorsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const bySupervisor = groupSum(data.reports, (row) => row.driver?.supervisor?.name || "بدون مشرف", (row) => row.orders, 10);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي المشرفين", value: data.supervisors.length },
      { title: "المشرفين النشطين", value: data.supervisors.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "إجمالي الفرق", value: data.supervisors.reduce((sum, row) => sum + row.drivers.length, 0) },
      { title: "متوسط أداء الفرق", value: `${avg(data.kpi.rows.map((row) => row.score))}%`, tone: "blue" },
      { title: "مشرفين فوق التارجت", value: bySupervisor.filter((row) => row.value >= 400).length, tone: "emerald" },
      { title: "مشرفين تحت التارجت", value: bySupervisor.filter((row) => row.value < 300).length, tone: "red" },
    ],
    gauges: [{ title: "متوسط On Time للفرق", value: data.kpi.summary.avgOnTime, target: 99 }],
    progress: [],
    charts: [
      { type: "bar", title: "أداء المشرفين حسب الطلبات", data: bySupervisor },
      { type: "bar", title: "توزيع المناديب على المشرفين", data: groupCount(data.drivers, (row) => row.supervisor?.name || "بدون مشرف") },
    ],
    topLists: [
      { title: "أفضل مشرفين", items: bySupervisor.slice(0, 5).map((row) => ({ label: row.name, value: row.value })) },
      { title: "أقل مشرفين أداء", items: [...bySupervisor].sort((a, b) => a.value - b.value).slice(0, 5).map((row) => ({ label: row.name, value: row.value })) },
      { title: "مشرفين لديهم مناديب بدون سيارة", items: groupCount(data.drivers.filter((row) => !row.vehicleId), (row) => row.supervisor?.name || "بدون مشرف").map((row) => ({ label: row.name, value: row.value })) },
    ],
    alerts: data.drivers.filter((row) => !row.supervisorId).length
      ? [{ title: "مناديب خارج نطاق المشرفين", body: `${data.drivers.filter((row) => !row.supervisorId).length} مندوب بدون مشرف.`, severity: "warning" }]
      : [],
  };
  analytics.insight = pageInsight("Supervisors", analytics);
  return analytics;
}

function citiesAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const avgAchievement = avg(data.cityRanking.map((row) => row.achievement));
  const charts = commonReportCharts(data);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي المدن", value: data.cities.length },
      { title: "المدن النشطة", value: data.cities.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "إجمالي الطلبات", value: data.reports.reduce((sum, row) => sum + row.orders, 0), tone: "blue" },
      { title: "متوسط تحقيق التارجت", value: `${avgAchievement}%`, tone: statusTone(avgAchievement, 100, 80) },
      { title: "مدن فوق التارجت", value: data.cityRanking.filter((row) => row.achievement >= 100).length, tone: "emerald" },
      { title: "مدن تحت التارجت", value: data.cityRanking.filter((row) => row.achievement < 80).length, tone: "red" },
    ],
    gauges: [{ title: "متوسط تحقيق المدن", value: avgAchievement }],
    progress: data.cityRanking.slice(0, 3).map((row) => ({ title: row.cityName, current: row.orders, target: row.monthlyTarget, suffix: "طلب" })),
    charts: [
      { type: "bar", title: "Orders by City", data: charts.ordersByCity },
      { type: "bar", title: "Drivers Count by City", data: groupCount(data.drivers, (row) => cityName(row.city)) },
      { type: "bar", title: "Projects Count by City", data: groupCount(data.projects, (row) => cityName(row.city)) },
      { type: "bar", title: "Supervisors Count by City", data: groupCount(data.supervisors, (row) => cityName(row.city)) },
    ],
    topLists: [
      { title: "أفضل المدن", items: data.cityRanking.slice(0, 5).map((row) => ({ label: row.cityName, value: `${row.achievement}%`, sub: `${row.orders} طلب` })) },
      { title: "أقل المدن أداء", items: [...data.cityRanking].sort((a, b) => a.score - b.score).slice(0, 5).map((row) => ({ label: row.cityName, value: `${row.score}%`, sub: row.appName })) },
    ],
    alerts: data.cityRanking.filter((row) => row.achievement < 80).slice(0, 5).map((row) => ({ title: "مدينة تحت التارجت", body: `${row.cityName} تحقق ${row.achievement}% فقط من التارجت.`, severity: "warning" as const })),
  };
  analytics.insight = pageInsight("Cities", analytics);
  return analytics;
}

function projectsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const avgAchievement = avg(data.projectPerformance.map((row) => row.achievement));
  const charts = commonReportCharts(data);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي المشاريع", value: data.projects.length },
      { title: "المشاريع النشطة", value: data.projects.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "إجمالي الطلبات", value: data.reports.reduce((sum, row) => sum + row.orders, 0), tone: "blue" },
      { title: "متوسط تحقيق التارجت", value: `${avgAchievement}%`, tone: statusTone(avgAchievement, 100, 80) },
      { title: "مشاريع فوق التارجت", value: data.projectPerformance.filter((row) => row.achievement >= 100).length, tone: "emerald" },
      { title: "مشاريع تحت التارجت", value: data.projectPerformance.filter((row) => row.achievement < 80).length, tone: "red" },
    ],
    gauges: [{ title: "متوسط تحقيق المشاريع", value: avgAchievement }],
    progress: data.projectPerformance.slice(0, 3).map((row) => ({ title: row.projectName, current: row.orders, target: Math.max(1, Math.round(row.orders / Math.max(row.achievement, 1) * 100)), suffix: "طلب" })),
    charts: [
      { type: "bar", title: "Orders by Project", data: charts.ordersByProject },
      { type: "bar", title: "Drivers by Project", data: groupCount(data.drivers, (row) => projectName(row.project)) },
      { type: "line", title: "Performance Trend by Project", data: charts.ordersTrend },
    ],
    topLists: [
      { title: "أفضل المشاريع", items: data.projectPerformance.slice(0, 5).map((row) => ({ label: row.projectName, value: `${row.score}%`, sub: `${row.orders} طلب` })) },
      { title: "مشاريع تحتاج مناديب", items: data.projects.filter((row) => row.drivers.length === 0).slice(0, 5).map((row) => ({ label: row.name, value: "0 مندوب", sub: row.appName ?? "" })) },
    ],
    alerts: data.projectPerformance.filter((row) => row.achievement < 80).slice(0, 5).map((row) => ({ title: "مشروع تحت التارجت", body: `${row.projectName} يحقق ${row.achievement}% من الهدف.`, severity: "warning" as const })),
  };
  analytics.insight = pageInsight("Projects", analytics);
  return analytics;
}

function vehiclesAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const totalRent = data.vehicles.reduce((sum, row) => sum + numberValue(row.monthlyRent), 0);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي السيارات", value: data.vehicles.length },
      { title: "السيارات المتاحة", value: data.vehicles.filter((row) => row.status === "AVAILABLE").length, tone: "emerald" },
      { title: "السيارات مع مناديب", value: data.vehicles.filter((row) => row.currentDriverId).length, tone: "blue" },
      { title: "السيارات في الصيانة", value: data.vehicles.filter((row) => row.status === "MAINTENANCE").length, tone: "amber" },
      { title: "سيارات بدون مندوب", value: data.vehicles.filter((row) => !row.currentDriverId).length, tone: "red" },
      { title: "إجمالي الإيجارات الشهرية", value: money(totalRent), tone: "blue" },
    ],
    gauges: [],
    progress: [],
    charts: [
      { type: "pie", title: "Vehicles by Status", data: groupCount(data.vehicles, (row) => row.status) },
      { type: "bar", title: "Vehicles by Rental Company", data: groupCount(data.vehicles, (row) => row.rentalCompany || "غير محدد") },
      { type: "bar", title: "Monthly Rent by Company", data: groupSum(data.vehicles, (row) => row.rentalCompany || "غير محدد", (row) => numberValue(row.monthlyRent)) },
    ],
    topLists: [
      { title: "السيارات بدون مندوب", items: data.vehicles.filter((row) => !row.currentDriverId).slice(0, 10).map((row) => ({ label: row.plateEn, value: row.status, sub: row.model ?? "" })) },
      { title: "السيارات الأعلى تكلفة", items: [...data.vehicles].sort((a, b) => numberValue(b.monthlyRent) - numberValue(a.monthlyRent)).slice(0, 5).map((row) => ({ label: row.plateEn, value: money(row.monthlyRent), sub: row.rentalCompany ?? "" })) },
    ],
    alerts: data.vehicles.filter((row) => row.status === "MAINTENANCE").map((row) => ({ title: "سيارة في الصيانة", body: `${row.plateEn} حالتها صيانة.`, severity: "warning" as const })).slice(0, 5),
  };
  analytics.insight = pageInsight("Vehicles", analytics);
  return analytics;
}

function applicationsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const appCounts = groupCount(data.accounts, (row) => row.appName);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي حسابات التطبيقات", value: data.accounts.length },
      { title: "حسابات Keeta", value: data.accounts.filter((row) => row.appName === "Keeta").length, tone: "emerald" },
      { title: "حسابات HungerStation", value: data.accounts.filter((row) => row.appName === "HungerStation").length, tone: "blue" },
      { title: "حسابات Talabat", value: data.accounts.filter((row) => row.appName === "Talabat").length, tone: "amber" },
      { title: "الحسابات النشطة", value: data.accounts.filter((row) => row.status === "ACTIVE").length, tone: "emerald" },
      { title: "الحسابات غير المربوطة", value: data.accounts.filter((row) => row.isEmpty || !row.driverId).length, tone: "red" },
    ],
    gauges: [],
    progress: [],
    charts: [
      { type: "pie", title: "Accounts by Application", data: appCounts },
      { type: "bar", title: "Accounts by Project", data: groupCount(data.accounts, (row) => row.project?.name || "غير محدد") },
      { type: "bar", title: "Reports Imported by Application", data: groupCount(data.importBatches, (row) => row.appName || row.importType || "غير محدد") },
    ],
    topLists: [
      { title: "مناديب بدون حساب تطبيق", items: data.drivers.filter((row) => !row.accountId).slice(0, 10).map((row) => ({ label: row.name, value: row.internalCode, sub: cityName(row.city) })) },
      { title: "حسابات تطبيق بدون مندوب", items: data.accounts.filter((row) => row.isEmpty || !row.driverId).slice(0, 10).map((row) => ({ label: row.username, value: row.appName })) },
    ],
    alerts: data.accounts.filter((row) => row.isEmpty || !row.driverId).length
      ? [{ title: "حسابات غير مربوطة", body: `يوجد ${data.accounts.filter((row) => row.isEmpty || !row.driverId).length} حساب تطبيق بدون مندوب.`, severity: "warning" }]
      : [],
  };
  analytics.insight = pageInsight("Applications", analytics);
  return analytics;
}

function dailyReportsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const charts = commonReportCharts(data);
  const avgHours = avg(data.reports.map((row) => numberValue(row.workingHours)));
  const avgOnTime = avg(data.reports.map((row) => numberValue(row.onTimeRate)));
  const avgCancellation = avg(data.reports.map((row) => numberValue(row.cancellationRate)));
  const avgRejection = avg(data.reports.map((row) => numberValue(row.rejectionRate)));
  const totalOrders = data.reports.reduce((sum, row) => sum + row.orders, 0);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي طلبات الشهر", value: totalOrders, tone: statusTone(totalOrders, 400, 300) },
      { title: "متوسط ساعات العمل", value: avgHours, tone: statusTone(avgHours, 10, 8) },
      { title: "متوسط On Time", value: `${avgOnTime}%`, tone: statusTone(avgOnTime, 99, 95) },
      { title: "إجمالي Cancellation", value: `${avgCancellation}%`, tone: statusTone(avgCancellation, 0, 0, true) },
      { title: "إجمالي Rejection", value: `${avgRejection}%`, tone: statusTone(avgRejection, 0, 0, true) },
    ],
    gauges: [
      { title: "On Time", value: avgOnTime, target: 99 },
      { title: "Working Hours", value: avgHours, target: 10, label: "الهدف 10 ساعات" },
    ],
    progress: [],
    charts: [
      { type: "line", title: "Orders Trend by Date", data: charts.ordersTrend },
      { type: "line", title: "Working Hours Trend", data: charts.hoursTrend },
      { type: "bar", title: "Orders by Application", data: charts.ordersByApp },
      { type: "bar", title: "Orders by City", data: charts.ordersByCity },
      { type: "bar", title: "Orders by Project", data: charts.ordersByProject },
    ],
    topLists: [],
    alerts: [
      data.reports.filter((row) => numberValue(row.workingHours) < 10).length ? { title: "ساعات عمل منخفضة", body: `${data.reports.filter((row) => numberValue(row.workingHours) < 10).length} تقرير أقل من 10 ساعات.`, severity: "warning" } : null,
      data.reports.filter((row) => numberValue(row.cancellationRate) > 0).length ? { title: "Cancellation موجود", body: "هناك تقارير بها إلغاء أكبر من صفر.", severity: "critical" } : null,
      data.reports.filter((row) => numberValue(row.rejectionRate) > 0).length ? { title: "Rejection موجود", body: "هناك تقارير بها رفض أكبر من صفر.", severity: "critical" } : null,
    ].filter(Boolean) as SmartAlert[],
  };
  analytics.insight = pageInsight("Daily Reports", analytics);
  return analytics;
}

function financeAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const revenues = data.revenues.reduce((sum, row) => sum + numberValue(row.amount), 0) + data.invoices.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const expenses = data.expenses.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const advances = data.advances.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const deductions = data.deductions.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const violations = data.violations.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const carRent = data.vehicles.reduce((sum, row) => sum + numberValue(row.monthlyRent), 0);
  const payroll = data.payrolls.reduce((sum, row) => sum + numberValue(row.netSalary), 0);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي الإيرادات", value: money(revenues), tone: "emerald" },
      { title: "إجمالي المصروفات", value: money(expenses), tone: "red" },
      { title: "إجمالي السلف", value: money(advances), tone: "amber" },
      { title: "إجمالي الخصومات", value: money(deductions), tone: "orange" },
      { title: "إجمالي المخالفات", value: money(violations), tone: "red" },
      { title: "إجمالي إيجارات السيارات", value: money(carRent), tone: "blue" },
      { title: "صافي الربح المتوقع", value: money(revenues - expenses - payroll - carRent), tone: revenues - expenses - payroll - carRent >= 0 ? "emerald" : "red" },
      { title: "الرواتب المستحقة", value: money(payroll), tone: "blue" },
    ],
    gauges: [],
    progress: [],
    charts: [
      { type: "bar", title: "Revenue vs Expenses", data: [{ name: "الإيرادات", value: revenues }, { name: "المصروفات", value: expenses }] },
      { type: "bar", title: "Advances by Month", data: groupSum(data.advances, (row) => row.deductionMonth || "غير محدد", (row) => numberValue(row.amount), 12) },
      { type: "bar", title: "Deductions by Type", data: groupSum(data.deductions, (row) => row.type, (row) => numberValue(row.amount)) },
      { type: "line", title: "Payroll Cost Trend", data: groupSum(data.payrolls, (row) => row.month, (row) => numberValue(row.netSalary), 12).sort((a, b) => a.name.localeCompare(b.name)) },
    ],
    topLists: [
      { title: "أعلى مناديب عليهم سلف", items: groupSum(data.advances, (row) => row.driver?.name || "غير محدد", (row) => numberValue(row.amount), 5).map((row) => ({ label: row.name, value: money(row.value) })) },
      { title: "أعلى مناديب عليهم خصومات", items: groupSum(data.deductions, (row) => row.driver?.name || "غير محدد", (row) => numberValue(row.amount), 5).map((row) => ({ label: row.name, value: money(row.value) })) },
      { title: "أعلى سيارات تكلفة", items: [...data.vehicles].sort((a, b) => numberValue(b.monthlyRent) - numberValue(a.monthlyRent)).slice(0, 5).map((row) => ({ label: row.plateEn, value: money(row.monthlyRent), sub: row.rentalCompany ?? "" })) },
    ],
    alerts: advances ? [{ title: "سلف قائمة", body: `إجمالي السلف الحالي ${money(advances)}.`, severity: "info" }] : [],
  };
  analytics.insight = pageInsight("Finance", analytics);
  return analytics;
}

function payrollAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const total = data.payrolls.reduce((sum, row) => sum + numberValue(row.basicSalary), 0);
  const net = data.payrolls.reduce((sum, row) => sum + numberValue(row.netSalary), 0);
  const bonus = data.payrolls.reduce((sum, row) => sum + numberValue(row.bonus), 0);
  const deductions = data.payrolls.reduce((sum, row) => sum + numberValue(row.deductions), 0);
  const levelA = data.payrolls.filter((row) => numberValue(row.netSalary) >= 2500).length;
  const levelB = data.payrolls.filter((row) => numberValue(row.netSalary) >= 1800 && numberValue(row.netSalary) < 2500).length;
  const levelC = data.payrolls.filter((row) => numberValue(row.netSalary) < 1800).length;
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي الرواتب", value: money(total) },
      { title: "صافي الرواتب", value: money(net), tone: net >= 0 ? "emerald" : "red" },
      { title: "إجمالي البونص", value: money(bonus), tone: "emerald" },
      { title: "إجمالي الخصومات", value: money(deductions), tone: "red" },
      { title: "عدد Level A", value: levelA, tone: "emerald" },
      { title: "عدد Level B", value: levelB, tone: "blue" },
      { title: "عدد Level C", value: levelC, tone: "red" },
    ],
    gauges: [],
    progress: [],
    charts: [
      { type: "bar", title: "Payroll by City", data: groupSum(data.payrolls, (row) => cityName(row.driver.city), (row) => numberValue(row.netSalary)) },
      { type: "bar", title: "Payroll by Project", data: groupSum(data.payrolls, (row) => row.project?.name || projectName(row.driver.project), (row) => numberValue(row.netSalary)) },
      { type: "pie", title: "Levels Distribution A/B/C", data: [{ name: "Level A", value: levelA }, { name: "Level B", value: levelB }, { name: "Level C", value: levelC }] },
    ],
    topLists: [
      { title: "أعلى صافي رواتب", items: [...data.payrolls].sort((a, b) => numberValue(b.netSalary) - numberValue(a.netSalary)).slice(0, 5).map((row) => ({ label: row.driver.name, value: money(row.netSalary), sub: row.month })) },
      { title: "خصومات عالية", items: [...data.payrolls].sort((a, b) => numberValue(b.deductions) - numberValue(a.deductions)).slice(0, 5).map((row) => ({ label: row.driver.name, value: money(row.deductions), sub: row.month })) },
    ],
    alerts: data.payrolls.filter((row) => numberValue(row.netSalary) < 0).length ? [{ title: "صافي راتب سالب", body: "يوجد رواتب صافيها بالسالب وتحتاج مراجعة.", severity: "critical" }] : [],
  };
  analytics.insight = pageInsight("Payroll", analytics);
  return analytics;
}

function importsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const success = data.importBatches.filter((row) => row.status === "APPROVED").length;
  const errors = data.importBatches.filter((row) => row.rowsSkipped > 0 || row.status !== "APPROVED").length;
  const imported = data.importBatches.reduce((sum, row) => sum + row.rowsImported, 0);
  const skipped = data.importBatches.reduce((sum, row) => sum + row.rowsSkipped, 0);
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إجمالي عمليات الاستيراد", value: data.importBatches.length },
      { title: "آخر عملية استيراد", value: data.importBatches[0]?.fileName ?? "لا يوجد", tone: "blue" },
      { title: "الملفات الناجحة", value: success, tone: "emerald" },
      { title: "ملفات بها أخطاء", value: errors, tone: errors ? "red" : "emerald" },
      { title: "الصفوف المستوردة", value: imported, tone: "emerald" },
      { title: "الصفوف المرفوضة", value: skipped, tone: skipped ? "red" : "emerald" },
    ],
    gauges: [{ title: "Import Success Rate", value: data.importBatches.length ? pct((success / data.importBatches.length) * 100) : 0 }],
    progress: [],
    charts: [
      { type: "pie", title: "Imports by Type", data: groupCount(data.importBatches, (row) => row.importType) },
      { type: "line", title: "Rows Imported Trend", data: groupSum(data.importBatches, (row) => row.createdAt.toISOString().slice(0, 10), (row) => row.rowsImported, 14).sort((a, b) => a.name.localeCompare(b.name)) },
    ],
    topLists: [],
    alerts: errors ? [{ title: "ملفات تحتاج مراجعة", body: `${errors} عملية استيراد بها صفوف مرفوضة أو حالة غير معتمدة.`, severity: "warning" }] : [],
  };
  analytics.insight = pageInsight("Imports", analytics);
  return analytics;
}

function reportsAnalytics(data: Awaited<ReturnType<typeof baseData>>) {
  return dashboardAnalytics(data);
}

function settingsAnalytics(data: Awaited<ReturnType<typeof baseData>>): PageAnalytics {
  const analytics: PageAnalytics = {
    metrics: [
      { title: "إعدادات النظام", value: data.systemSettings.length, tone: "blue" },
      { title: "مشاكل تنظيف البيانات", value: data.dataCleaningIssues.length, tone: data.dataCleaningIssues.length ? "amber" : "emerald" },
      { title: "Audit Logs", value: "متاح", tone: "slate" },
      { title: "Backup / Restore", value: "مجهز", tone: "blue" },
    ],
    gauges: [],
    progress: [],
    charts: [{ type: "pie", title: "Data Issues by Severity", data: groupCount(data.dataCleaningIssues, (row) => row.severity) }],
    topLists: [{ title: "أحدث مشاكل البيانات", items: data.dataCleaningIssues.slice(0, 5).map((row) => ({ label: row.issueType, value: row.severity, sub: row.entityType })) }],
    alerts: data.dataCleaningIssues.length ? [{ title: "تنظيف البيانات مطلوب", body: `${data.dataCleaningIssues.length} مشكلة بيانات مفتوحة تحتاج معالجة.`, severity: "warning", href: "/data-cleaning" }] : [],
  };
  analytics.insight = pageInsight("Settings", analytics);
  return analytics;
}

export async function getPageAnalytics(page: string): Promise<PageAnalytics> {
  try {
    const data = await baseData();
    switch (page) {
      case "dashboard":
        return dashboardAnalytics(data);
      case "drivers":
        return driversAnalytics(data);
      case "supervisors":
        return supervisorsAnalytics(data);
      case "cities":
        return citiesAnalytics(data);
      case "projects":
        return projectsAnalytics(data);
      case "vehicles":
        return vehiclesAnalytics(data);
      case "applications":
        return applicationsAnalytics(data);
      case "daily-reports":
        return dailyReportsAnalytics(data);
      case "finance":
        return financeAnalytics(data);
      case "payroll":
        return payrollAnalytics(data);
      case "imports":
        return importsAnalytics(data);
      case "reports":
      case "management-reports":
        return reportsAnalytics(data);
      case "city-ranking":
        return citiesAnalytics(data);
      case "rider-kpi":
        return driversAnalytics(data);
      case "performance-analysis":
        return reportsAnalytics(data);
      case "settings":
        return settingsAnalytics(data);
      default:
        return emptyAnalytics;
    }
  } catch {
    return emptyAnalytics;
  }
}
