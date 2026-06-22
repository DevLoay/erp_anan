import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getFilterOptions, getRulesForApp, getSystemRules, type ReportFilterOptions } from "./reporting";

export type SupervisorPerformanceFilters = {
  month: string;
  from: string;
  to: string;
  q: string;
  cityId: string;
  appName: string;
  supervisorId: string;
};

export type SupervisorScoreItem = {
  label: string;
  score: number | null;
  note: string;
};

export type SupervisorTaskItem = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  driverName: string;
};

export type SupervisorPerformanceRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cityId: string;
  cityName: string;
  status: string;
  linkedDrivers: number;
  activeDrivers: number;
  reportsCount: number;
  tasksCount: number;
  openTasks: number;
  applicationsCount: number;
  totalOrders: number;
  workingHours: number;
  onTimeRate: number | null;
  cancellationRate: number | null;
  rejectionRate: number | null;
  targetOrders: number;
  targetAchievement: number | null;
  personalScore: number;
  operationalScore: number | null;
  finalKpi: number | null;
  statusLabel: "طبيعي" | "يحتاج متابعة" | "لا يوجد مناديب" | "لا توجد تقارير";
  warnings: string[];
  personalItems: SupervisorScoreItem[];
  operationalItems: SupervisorScoreItem[];
  teamDrivers: { id: string; name: string; code: string; cityName: string; projectName: string; status: string }[];
  tasks: SupervisorTaskItem[];
};

export type SupervisorPerformanceReport = {
  filters: SupervisorPerformanceFilters;
  options: ReportFilterOptions;
  summary: {
    supervisors: number;
    activeSupervisors: number;
    linkedDrivers: number;
    periodReports: number;
    avgFinalKpi: number | null;
    weakSupervisors: number;
    openTasks: number;
  };
  rows: SupervisorPerformanceRow[];
  tasks: SupervisorTaskItem[];
};

function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function cityName(city?: { nameAr: string | null; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "غير محدد";
}

function monthBounds(month: string) {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!year || monthIndex < 0) {
    return { from: "2026-04-01", to: "2026-04-30" };
  }
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { from: dateOnly(from), to: dateOnly(to) };
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff || 1);
}

function weightedAverage(items: { score: number | null; weight: number }[]) {
  const valid = items.filter((item) => item.score !== null);
  const weight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!weight) return null;
  return clamp(valid.reduce((sum, item) => sum + Number(item.score) * item.weight, 0) / weight);
}

function scoreToneStatus(finalKpi: number | null, linkedDrivers: number, reportsCount: number): SupervisorPerformanceRow["statusLabel"] {
  if (!linkedDrivers) return "لا يوجد مناديب";
  if (!reportsCount) return "لا توجد تقارير";
  if (finalKpi !== null && finalKpi < 75) return "يحتاج متابعة";
  return "طبيعي";
}

function textMatches(row: SupervisorPerformanceRow, q: string) {
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  return [row.name, row.email, row.phone, row.cityName, ...row.teamDrivers.map((driver) => `${driver.name} ${driver.code}`)]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export async function getSupervisorPerformanceReport(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<SupervisorPerformanceReport> {
  const options = await getFilterOptions();
  const selectedMonth = one(searchParams.month) || (options.months.includes("2026-04") ? "2026-04" : options.months[0]) || "2026-04";
  const bounds = monthBounds(selectedMonth);
  const filters: SupervisorPerformanceFilters = {
    month: selectedMonth,
    from: one(searchParams.from) || bounds.from,
    to: one(searchParams.to) || bounds.to,
    q: one(searchParams.q),
    cityId: one(searchParams.cityId),
    appName: one(searchParams.appName),
    supervisorId: one(searchParams.supervisorId),
  };

  const settings = await getSystemRules();
  const periodDays = daysBetween(filters.from, filters.to);
  const reportWhere: Prisma.DailyReportWhereInput = {
    reportDate: {
      gte: new Date(`${filters.from}T00:00:00.000Z`),
      lte: new Date(`${filters.to}T23:59:59.999Z`),
    },
  };
  if (filters.appName) reportWhere.appName = filters.appName;
  if (filters.cityId) reportWhere.cityId = filters.cityId;
  if (filters.supervisorId) reportWhere.driver = { is: { supervisorId: filters.supervisorId } };

  const supervisorWhere: Prisma.SupervisorWhereInput = {};
  if (filters.cityId) supervisorWhere.cityId = filters.cityId;
  if (filters.supervisorId) supervisorWhere.id = filters.supervisorId;

  const [supervisors, reports, tasks] = await Promise.all([
    prisma.supervisor.findMany({
      where: supervisorWhere,
      include: {
        city: { select: { nameAr: true, nameEn: true } },
        drivers: {
          select: {
            id: true,
            internalCode: true,
            name: true,
            cityId: true,
            projectId: true,
            supervisorId: true,
            accountId: true,
            status: true,
            city: { select: { nameAr: true, nameEn: true } },
            project: { select: { name: true, appName: true } },
            account: { select: { id: true, username: true } },
            applicationAccounts: {
              take: 1,
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                application: { select: { name: true } },
                applicationProject: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.dailyReport.findMany({
      where: reportWhere,
      select: {
        id: true,
        appName: true,
        applicationProject: { select: { application: { select: { name: true } } } },
        orders: true,
        workingHours: true,
        onTimeRate: true,
        cancellationRate: true,
        rejectionRate: true,
        driver: {
          select: {
            supervisorId: true,
            project: { select: { appName: true } },
          },
        },
      },
      orderBy: { reportDate: "desc" },
    }),
    prisma.task.findMany({
      where: filters.supervisorId ? { supervisorId: filters.supervisorId } : {},
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        dueDate: true,
        supervisorId: true,
        driver: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  const reportsBySupervisor = new Map<string, typeof reports>();
  for (const report of reports) {
    const supervisorId = report.driver?.supervisorId;
    if (!supervisorId) continue;
    reportsBySupervisor.set(supervisorId, [...(reportsBySupervisor.get(supervisorId) ?? []), report]);
  }

  const tasksBySupervisor = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.supervisorId) continue;
    tasksBySupervisor.set(task.supervisorId, [...(tasksBySupervisor.get(task.supervisorId) ?? []), task]);
  }

  const rows = supervisors.map((supervisor) => {
    const teamDrivers = supervisor.drivers.filter((driver) => {
      if (filters.cityId && driver.cityId !== filters.cityId) return false;
      const driverAppName = driver.applicationAccounts[0]?.application?.name || driver.project?.appName || "";
      if (filters.appName && driverAppName !== filters.appName) return false;
      return true;
    });
    const supervisorReports = reportsBySupervisor.get(supervisor.id) ?? [];
    const supervisorTasks = tasksBySupervisor.get(supervisor.id) ?? [];
    const linkedDrivers = teamDrivers.length;
    const activeDrivers = teamDrivers.filter((driver) => driver.status === "ACTIVE").length;
    const apps = new Set(
      [
        ...teamDrivers.map((driver) => driver.applicationAccounts[0]?.application?.name || driver.project?.appName || ""),
        ...supervisorReports.map((report) => report.applicationProject?.application.name || report.appName || report.driver?.project?.appName || ""),
      ].filter(Boolean),
    );
    const totalOrders = supervisorReports.reduce((sum, report) => sum + report.orders, 0);
    const workingHours = supervisorReports.reduce((sum, report) => sum + numberValue(report.workingHours), 0);
    const reportCount = supervisorReports.length;
    const onTimeRate = reportCount ? pct(supervisorReports.reduce((sum, report) => sum + numberValue(report.onTimeRate), 0) / reportCount) : null;
    const cancellationRate = reportCount ? pct(supervisorReports.reduce((sum, report) => sum + numberValue(report.cancellationRate), 0) / reportCount) : null;
    const rejectionRate = reportCount ? pct(supervisorReports.reduce((sum, report) => sum + numberValue(report.rejectionRate), 0) / reportCount) : null;

    const monthlyTarget = teamDrivers.reduce((sum, driver) => {
      const appName = filters.appName || driver.applicationAccounts[0]?.application?.name || driver.project?.appName || "Keeta";
      const rules = getRulesForApp(appName, settings);
      const target = filters.from || filters.to ? rules.dailyOrders * periodDays : rules.monthlyOrders;
      return sum + target;
    }, 0);
    const targetAchievement = monthlyTarget ? pct((totalOrders / monthlyTarget) * 100) : null;
    const hoursTarget = teamDrivers.reduce((sum, driver) => {
      const appName = filters.appName || driver.applicationAccounts[0]?.application?.name || driver.project?.appName || "Keeta";
      const rules = getRulesForApp(appName, settings);
      return sum + (filters.from || filters.to ? (rules.workingHours / 30) * periodDays : rules.workingHours);
    }, 0);
    const hoursScore = hoursTarget ? clamp((workingHours / hoursTarget) * 100) : null;
    const achievementScore = targetAchievement === null ? null : clamp(targetAchievement);
    const onTimeScore = onTimeRate === null ? null : clamp(onTimeRate);
    const cancellationScore = cancellationRate === null ? null : clamp(100 - cancellationRate * 20);
    const rejectionScore = rejectionRate === null ? null : clamp(100 - rejectionRate * 10);
    const operationalScore = reportCount
      ? weightedAverage([
          { score: achievementScore, weight: 35 },
          { score: onTimeScore, weight: 25 },
          { score: hoursScore, weight: 20 },
          { score: cancellationScore, weight: 10 },
          { score: rejectionScore, weight: 10 },
        ])
      : null;

    const completedTasks = supervisorTasks.filter((task) => ["APPROVED", "LOCKED"].includes(task.status)).length;
    const taskScore = supervisorTasks.length ? clamp((completedTasks / supervisorTasks.length) * 100) : null;
    const profileScore = clamp(
      (supervisor.phone ? 25 : 0) +
        (supervisor.email ? 25 : 0) +
        (supervisor.cityId ? 20 : 0) +
        (supervisor.status === "ACTIVE" ? 30 : 0),
    );
    const teamOrganizationScore = linkedDrivers
      ? clamp(
          (activeDrivers / linkedDrivers) * 40 +
            (teamDrivers.filter((driver) => driver.applicationAccounts[0]?.applicationProject).length / linkedDrivers) * 25 +
            (teamDrivers.filter((driver) => driver.applicationAccounts[0]?.id || driver.accountId).length / linkedDrivers) * 20 +
            (teamDrivers.filter((driver) => driver.cityId).length / linkedDrivers) * 15,
        )
      : null;
    const personalScore =
      weightedAverage([
        { score: profileScore, weight: 35 },
        { score: teamOrganizationScore, weight: 35 },
        { score: taskScore, weight: 30 },
      ]) ?? profileScore;
    const finalKpi =
      operationalScore !== null
        ? weightedAverage([
            { score: personalScore, weight: 50 },
            { score: operationalScore, weight: 50 },
          ])
        : null;

    const warnings: string[] = [];
    if (!linkedDrivers) warnings.push("لا يوجد مناديب");
    if (linkedDrivers && !reportCount) warnings.push("لا توجد تقارير للفترة");
    if (finalKpi !== null && finalKpi < 75) warnings.push("KPI أقل من 75%");
    if (supervisorTasks.some((task) => !["APPROVED", "LOCKED"].includes(task.status))) warnings.push("مهام مفتوحة");
    if (teamDrivers.some((driver) => !driver.applicationAccounts[0]?.applicationProject)) warnings.push("مناديب بدون مشروع تشغيل");
    if (teamDrivers.some((driver) => !driver.applicationAccounts[0]?.id && !driver.accountId)) warnings.push("مناديب بدون حساب تطبيق");

    const taskItems = supervisorTasks.slice(0, 12).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      dueDate: dateOnly(task.dueDate),
      driverName: task.driver?.name ?? "",
    }));

    const row: SupervisorPerformanceRow = {
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email ?? "",
      phone: supervisor.phone ?? "",
      cityId: supervisor.cityId ?? "",
      cityName: cityName(supervisor.city),
      status: supervisor.status,
      linkedDrivers,
      activeDrivers,
      reportsCount: reportCount,
      tasksCount: supervisorTasks.length,
      openTasks: supervisorTasks.filter((task) => !["APPROVED", "LOCKED"].includes(task.status)).length,
      applicationsCount: apps.size,
      totalOrders,
      workingHours: Math.round(workingHours * 10) / 10,
      onTimeRate,
      cancellationRate,
      rejectionRate,
      targetOrders: Math.round(monthlyTarget),
      targetAchievement,
      personalScore,
      operationalScore,
      finalKpi,
      statusLabel: scoreToneStatus(finalKpi, linkedDrivers, reportCount),
      warnings,
      personalItems: [
        { label: "التعامل والسلوك الوظيفي", score: profileScore, note: "محسوب من اكتمال بيانات التواصل والحالة والمدينة." },
        { label: "مهارات التواصل", score: supervisor.phone || supervisor.email ? clamp((supervisor.phone ? 50 : 0) + (supervisor.email ? 50 : 0)) : null, note: "رقم الجوال والبريد المحفوظان في ملف المشرف." },
        { label: "الالتزام والاستجابة", score: taskScore, note: supervisorTasks.length ? "نسبة المهام المغلقة من مهام المشرف." : "لا توجد مهام كافية للحساب." },
        { label: "الاحترافية والانضباط", score: profileScore, note: "الحالة النشطة وربط المدينة واكتمال الملف." },
        { label: "تنظيم الفريق", score: teamOrganizationScore, note: linkedDrivers ? "ربط مناديب الفريق بالمشروع والحساب والمدينة." : "لا يوجد مناديب مرتبطون." },
        { label: "نتيجة التقييم الشخصي", score: personalScore, note: "وزنها 50% من KPI النهائي عند وجود تقييم عملي." },
      ],
      operationalItems: [
        { label: "متابعة المهام التشغيلية", score: taskScore, note: supervisorTasks.length ? "نسبة المهام المعتمدة أو المغلقة." : "لا توجد مهام كافية." },
        { label: "إعداد التقارير التحليلية", score: reportCount ? clamp((reportCount / Math.max(linkedDrivers, 1)) * 10) : null, note: "كثافة التقارير المحفوظة مقارنة بعدد الفريق." },
        { label: "تقارير الأداء حسب التطبيقات", score: achievementScore, note: "تحقيق الطلبات مقابل تارجت الفترة." },
        { label: "أداء المناديب المرتبطين", score: operationalScore, note: "متوسط مؤشرات الطلبات والساعات والالتزام والإلغاء والرفض." },
        { label: "رفع مستوى الأداء العام", score: onTimeScore, note: "مبني على متوسط On-Time للفريق." },
        { label: "نتيجة التقييم العملي", score: operationalScore, note: "وزنها 50% من KPI النهائي عند توفر تقارير." },
      ],
      teamDrivers: teamDrivers.slice(0, 20).map((driver) => ({
        id: driver.id,
        name: driver.name,
        code: driver.internalCode,
        cityName: cityName(driver.city),
        projectName: driver.applicationAccounts[0]?.applicationProject?.name || driver.project?.name || "بدون مشروع",
        status: driver.status,
      })),
      tasks: taskItems,
    };
    return row;
  });

  const filteredRows = rows.filter((row) => textMatches(row, filters.q)).sort((a, b) => (b.finalKpi ?? -1) - (a.finalKpi ?? -1));
  const scored = filteredRows.filter((row) => row.finalKpi !== null);
  const taskItems = tasks.slice(0, 50).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    status: task.status,
    dueDate: dateOnly(task.dueDate),
    driverName: task.driver?.name ?? "",
  }));

  return {
    filters,
    options,
    rows: filteredRows,
    tasks: taskItems,
    summary: {
      supervisors: filteredRows.length,
      activeSupervisors: filteredRows.filter((row) => row.status === "ACTIVE").length,
      linkedDrivers: filteredRows.reduce((sum, row) => sum + row.linkedDrivers, 0),
      periodReports: filteredRows.reduce((sum, row) => sum + row.reportsCount, 0),
      avgFinalKpi: scored.length ? Math.round(scored.reduce((sum, row) => sum + Number(row.finalKpi), 0) / scored.length) : null,
      weakSupervisors: filteredRows.filter((row) => row.finalKpi !== null && row.finalKpi < 75).length,
      openTasks: filteredRows.reduce((sum, row) => sum + row.openTasks, 0),
    },
  };
}
