import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import type { AccessScope } from "@/lib/auth/accessScope";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return Number(value) || 0;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    SUSPENDED: "موقوف",
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "emerald" | "red" | "amber" | "slate" {
  if (status === "ACTIVE") return "emerald";
  if (status === "SUSPENDED" || status === "INACTIVE") return "red";
  if (status === "PENDING") return "amber";
  return "slate";
}

export type DriverManagementFilters = {
  q: string;
  cityId: string;
  projectId: string;
  supervisorId: string;
  status: string;
  nationality: string;
  vehicleOwnershipType: string;
  newDriver: string;
  fromDate: string;
  toDate: string;
};

export type DriverManagementRow = {
  id: string;
  driverCode: string;
  name: string;
  nationalId: string;
  mobile: string;
  nationality: string;
  city: string;
  cityId: string;
  project: string;
  projectId: string;
  application: string;
  supervisorId: string;
  accountId: string;
  appUserId: string;
  appUsername: string;
  supervisor: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleType: string;
  vehicleOwnershipType: string;
  rentalDays: number;
  status: string;
  statusLabel: string;
  statusTone: "emerald" | "red" | "amber" | "slate";
  monthOrders: number;
  approvedAdvances: number;
  pendingAdvances: number;
  violationsTotal: number;
  fuelTotal: number;
  deductionsTotal: number;
  netPayroll: number;
  rating: number | null;
  lastReportDate: string;
};

export type DriverManagementData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: DriverManagementFilters;
  cities: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  supervisors: { id: string; name: string; cityId: string }[];
  vehicles: { id: string; label: string; cityId: string; currentDriverId: string }[];
  accounts: { id: string; label: string; cityId: string; applicationProjectId: string; driverId: string }[];
  nationalities: string[];
  summary: {
    totalDrivers: number;
    activeDrivers: number;
    suspendedDrivers: number;
    withoutSupervisor: number;
    withoutVehicle: number;
    withoutAppAccount: number;
    monthOrders: number;
    approvedAdvances: number;
    pendingAdvances: number;
  };
  insight: string;
  rows: DriverManagementRow[];
};

export function resolveDriverManagementFilters(params: SearchParams): DriverManagementFilters {
  const now = new Date();
  const defaultFrom = monthStart(now);
  return {
    q: one(params, "q").trim(),
    cityId: one(params, "cityId"),
    projectId: one(params, "projectId"),
    supervisorId: one(params, "supervisorId"),
    status: one(params, "status"),
    nationality: one(params, "nationality"),
    vehicleOwnershipType: one(params, "vehicleOwnershipType"),
    newDriver: one(params, "newDriver") || one(params, "new"),
    fromDate: one(params, "fromDate") || formatDateInput(defaultFrom),
    toDate: one(params, "toDate") || formatDateInput(now),
  };
}

function buildInsight(summary: DriverManagementData["summary"]) {
  if (!summary.totalDrivers) return "لا توجد بيانات مناديب كافية لإظهار تحليل دقيق حالياً.";
  const issues: string[] = [];
  if (summary.withoutSupervisor) issues.push(`${summary.withoutSupervisor} مندوب بدون مشرف`);
  if (summary.withoutVehicle) issues.push(`${summary.withoutVehicle} مندوب بدون سيارة`);
  if (summary.withoutAppAccount) issues.push(`${summary.withoutAppAccount} مندوب بدون حساب تطبيق`);
  if (!issues.length) return "بيانات المناديب مكتملة تشغيلياً في النطاق الحالي، ولا توجد فجوات ربط ظاهرة.";
  return `يوجد ${issues.join("، ")}. يفضل معالجة الربط قبل اعتماد التقارير أو المسير.`;
}

export async function getDriverManagementData(filters: DriverManagementFilters, accessScope?: AccessScope): Promise<DriverManagementData> {
  try {
    const fromDate = parseDate(filters.fromDate, monthStart(new Date()));
    const toDate = parseDate(filters.toDate, new Date());
    toDate.setHours(23, 59, 59, 999);

    const scopeAnd: Prisma.DriverWhereInput[] = [];
    if (accessScope && !accessScope.isGlobal) {
      if (accessScope.cityIds.length) scopeAnd.push({ cityId: { in: accessScope.cityIds } });
      if (accessScope.projectIds.length) {
        scopeAnd.push({ applicationAccounts: { some: { applicationProjectId: { in: accessScope.projectIds } } } });
      } else if (!accessScope.cityIds.length && accessScope.supervisorId) {
        scopeAnd.push({ supervisorId: accessScope.supervisorId });
      }
      if (accessScope.driverId) scopeAnd.push({ id: accessScope.driverId });
    }
    const scopeWhere: Prisma.DriverWhereInput = scopeAnd.length ? { AND: scopeAnd } : {};
    const filterWhere: Prisma.DriverWhereInput = {
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.projectId
        ? {
            applicationAccounts: {
              some: {
                applicationProjectId: filters.projectId,
              },
            },
          }
        : {}),
      ...(filters.status ? { status: filters.status as Prisma.EnumDriverStatusFilter["equals"] } : {}),
      ...(filters.nationality ? { nationality: filters.nationality } : {}),
      ...(filters.supervisorId ? { supervisorId: filters.supervisorId } : {}),
      ...(filters.vehicleOwnershipType ? { vehicleOwnershipType: filters.vehicleOwnershipType } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { actualName: { contains: filters.q, mode: "insensitive" } },
              { internalCode: { contains: filters.q, mode: "insensitive" } },
              { driverCode: { contains: filters.q, mode: "insensitive" } },
              { nationalId: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q, mode: "insensitive" } },
              { mobile: { contains: filters.q, mode: "insensitive" } },
              { applicationAccounts: { some: { appUserId: { contains: filters.q, mode: "insensitive" } } } },
              { applicationAccounts: { some: { appUsername: { contains: filters.q, mode: "insensitive" } } } },
              { applicationAccounts: { some: { username: { contains: filters.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const where: Prisma.DriverWhereInput = { AND: [scopeWhere, filterWhere] };

    const cityWhere: Prisma.CityWhereInput =
      accessScope && !accessScope.isGlobal && accessScope.cityIds.length ? { id: { in: accessScope.cityIds } } : {};
    const projectWhere: Prisma.ApplicationProjectWhereInput = {
      AND: [
        accessScope && !accessScope.isGlobal && accessScope.projectIds.length ? { id: { in: accessScope.projectIds } } : {},
        accessScope && !accessScope.isGlobal && accessScope.cityIds.length ? { cityId: { in: accessScope.cityIds } } : {},
      ],
    };
    const supervisorWhere: Prisma.SupervisorWhereInput =
      accessScope && !accessScope.isGlobal && accessScope.projectIds.length && accessScope.supervisorId
        ? { id: accessScope.supervisorId }
        : accessScope && !accessScope.isGlobal && accessScope.cityIds.length
          ? { cityId: { in: accessScope.cityIds } }
          : {};
    const vehicleScopeAnd: Prisma.VehicleWhereInput[] = [];
    if (accessScope && !accessScope.isGlobal) {
      if (accessScope.cityIds.length) vehicleScopeAnd.push({ cityId: { in: accessScope.cityIds } });
      if (accessScope.projectIds.length) {
        vehicleScopeAnd.push({
          currentDriver: { is: { applicationAccounts: { some: { applicationProjectId: { in: accessScope.projectIds } } } } },
        });
      }
    }
    const accountScopeAnd: Prisma.ApplicationAccountWhereInput[] = [];
    if (accessScope && !accessScope.isGlobal) {
      if (accessScope.cityIds.length) accountScopeAnd.push({ cityId: { in: accessScope.cityIds } });
      if (accessScope.projectIds.length) accountScopeAnd.push({ applicationProjectId: { in: accessScope.projectIds } });
    }

    const [drivers, cities, projects, supervisors, vehicles, accounts, allNationalities, totalDrivers, activeDrivers, suspendedDrivers] = await Promise.all([
      prisma.driver.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 500,
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          project: { select: { id: true, name: true, appName: true } },
          supervisor: { select: { id: true, name: true } },
          vehicle: { select: { id: true, plateAr: true, plateArabic: true, plateEn: true, plateEnglish: true, model: true } },
          account: {
            select: {
              id: true,
              appName: true,
              username: true,
              appUserId: true,
              appUsername: true,
              applicationProjectId: true,
              application: { select: { name: true, code: true } },
              applicationProject: { select: { name: true } },
            },
          },
          applicationAccounts: {
            ...(accessScope && !accessScope.isGlobal && accessScope.projectIds.length
              ? { where: { applicationProjectId: { in: accessScope.projectIds } } }
              : {}),
            take: 1,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              appName: true,
              username: true,
              appUserId: true,
              appUsername: true,
              applicationProjectId: true,
              application: { select: { name: true, code: true } },
              applicationProject: { select: { name: true } },
            },
          },
          vehicleAssignments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { startDate: "desc" },
            select: { rentalDays: true, calculatedRent: true, vehicle: { select: { plateAr: true, plateArabic: true, plateEn: true, plateEnglish: true, model: true } } },
          },
          reports: {
            where: { reportDate: { gte: fromDate, lte: toDate } },
            orderBy: { reportDate: "desc" },
            select: { reportDate: true, orders: true, workingHours: true, onTimeRate: true, cancellationRate: true, rejectionRate: true },
          },
          advances: { select: { amount: true, remainingAmount: true, status: true } },
          violations: { select: { amount: true, status: true } },
          deductions: { select: { amount: true, status: true } },
          fuelRecords: { select: { amount: true, status: true } },
          payrollItems: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            select: { netSalary: true, level: true, status: true },
          },
        },
      }),
      prisma.city.findMany({ where: cityWhere, orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.applicationProject.findMany({ where: projectWhere, orderBy: [{ application: { name: "asc" } }, { name: "asc" }], select: { id: true, name: true, application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } } }),
      prisma.supervisor.findMany({ where: supervisorWhere, orderBy: { name: "asc" }, select: { id: true, name: true, cityId: true } }),
      prisma.vehicle.findMany({
        where: { AND: [{ OR: [{ currentDriverId: null }, { status: "AVAILABLE" }] }, ...vehicleScopeAnd] },
        orderBy: [{ plateAr: "asc" }, { plateEn: "asc" }],
        select: { id: true, plateAr: true, plateArabic: true, plateEn: true, plateEnglish: true, model: true, cityId: true, currentDriverId: true },
        take: 500,
      }),
      prisma.applicationAccount.findMany({
        where: { AND: [{ OR: [{ driverId: null }, { isEmpty: true }] }, ...accountScopeAnd] },
        orderBy: [{ appName: "asc" }, { username: "asc" }],
        select: {
          id: true,
          appName: true,
          username: true,
          appUserId: true,
          appUsername: true,
          cityId: true,
          applicationProjectId: true,
          driverId: true,
          applicationProject: { select: { name: true } },
        },
        take: 500,
      }),
      prisma.driver.findMany({ distinct: ["nationality"], where: { AND: [scopeWhere, { nationality: { not: null } }] }, select: { nationality: true }, take: 200 }),
      prisma.driver.count({ where: scopeWhere }),
      prisma.driver.count({ where: { AND: [scopeWhere, { status: "ACTIVE" }] } }),
      prisma.driver.count({ where: { AND: [scopeWhere, { status: { in: ["SUSPENDED", "INACTIVE"] } }] } }),
    ]);

    const rows = drivers.map<DriverManagementRow>((driver) => {
      const account = driver.account ?? driver.applicationAccounts[0] ?? null;
      const assignment = driver.vehicleAssignments[0] ?? null;
      const vehicle = driver.vehicle ?? assignment?.vehicle ?? null;
      const monthOrders = driver.reports.reduce((sum, report) => sum + report.orders, 0);
      const reportCount = driver.reports.length;
      const avgOnTime = reportCount ? driver.reports.reduce((sum, report) => sum + toNumber(report.onTimeRate), 0) / reportCount : 0;
      const avgCancellation = reportCount ? driver.reports.reduce((sum, report) => sum + toNumber(report.cancellationRate), 0) / reportCount : 0;
      const avgRejection = reportCount ? driver.reports.reduce((sum, report) => sum + toNumber(report.rejectionRate), 0) / reportCount : 0;
      const rating = reportCount ? Math.max(1, Math.min(5, 2 + avgOnTime / 35 - avgCancellation / 30 - avgRejection / 30 + Math.min(monthOrders, 400) / 400)).toFixed(1) : null;
      const approvedAdvances = driver.advances.filter((advance) => String(advance.status) === "APPROVED").reduce((sum, advance) => sum + toNumber(advance.amount), 0);
      const pendingAdvances = driver.advances.filter((advance) => String(advance.status) === "PENDING").reduce((sum, advance) => sum + toNumber(advance.amount), 0);
      const status = String(driver.status);

      return {
        id: driver.id,
        driverCode: driver.internalCode || driver.driverCode || "-",
        name: driver.actualName || driver.name,
        nationalId: driver.nationalId || "-",
        mobile: driver.mobile || driver.phone || "-",
        nationality: driver.nationality || "-",
        city: driver.city?.nameAr || driver.city?.nameEn || "-",
        cityId: driver.cityId || "",
        project: account?.applicationProject?.name || driver.project?.name || "-",
        projectId: account?.applicationProjectId || "",
        application: account?.application?.name || account?.appName || driver.project?.appName || "-",
        supervisorId: driver.supervisorId || "",
        accountId: account?.id || "",
        appUserId: account?.appUserId || account?.username || "-",
        appUsername: account?.appUsername || account?.username || "-",
        supervisor: driver.supervisor?.name || "-",
        vehicleId: driver.vehicleId || "",
        vehiclePlate: vehicle?.plateArabic || vehicle?.plateAr || vehicle?.plateEnglish || vehicle?.plateEn || "-",
        vehicleType: vehicle?.model || driver.accommodationType || "-",
        vehicleOwnershipType: driver.vehicleOwnershipType || "no_vehicle",
        rentalDays: assignment?.rentalDays ?? 0,
        status,
        statusLabel: statusLabel(status),
        statusTone: statusTone(status),
        monthOrders,
        approvedAdvances,
        pendingAdvances,
        violationsTotal: driver.violations.reduce((sum, violation) => sum + toNumber(violation.amount), 0),
        fuelTotal: driver.fuelRecords.reduce((sum, fuel) => sum + toNumber(fuel.amount), 0),
        deductionsTotal: driver.deductions.reduce((sum, deduction) => sum + toNumber(deduction.amount), 0),
        netPayroll: toNumber(driver.payrollItems[0]?.netSalary),
        rating: rating === null ? null : Number(rating),
        lastReportDate: driver.reports[0]?.reportDate ? formatDateInput(driver.reports[0].reportDate) : "-",
      };
    });

    const summary = {
      totalDrivers,
      activeDrivers,
      suspendedDrivers,
      withoutSupervisor: rows.filter((row) => row.supervisor === "-").length,
      withoutVehicle: rows.filter((row) => row.vehiclePlate === "-").length,
      withoutAppAccount: rows.filter((row) => row.appUserId === "-" && row.appUsername === "-").length,
      monthOrders: rows.reduce((sum, row) => sum + row.monthOrders, 0),
      approvedAdvances: rows.reduce((sum, row) => sum + row.approvedAdvances, 0),
      pendingAdvances: rows.reduce((sum, row) => sum + row.pendingAdvances, 0),
    };

    return {
      databaseStatus: "online",
      filters,
      cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || "مدينة بدون اسم" })),
      projects: projects.map((project) => ({ id: project.id, name: project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim() || "مشروع بدون اسم" })),
      supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name, cityId: supervisor.cityId || "" })),
      vehicles: vehicles.map((vehicle) => {
        const plate = vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.id;
        return { id: vehicle.id, label: [plate, vehicle.model].filter(Boolean).join(" - "), cityId: vehicle.cityId || "", currentDriverId: vehicle.currentDriverId || "" };
      }),
      accounts: accounts.map((account) => ({
        id: account.id,
        label: [account.appName, account.applicationProject?.name, account.appUserId || account.username, account.appUsername].filter(Boolean).join(" - "),
        cityId: account.cityId || "",
        applicationProjectId: account.applicationProjectId || "",
        driverId: account.driverId || "",
      })),
      nationalities: allNationalities.map((row) => row.nationality).filter((value): value is string => Boolean(value)).sort((a, b) => a.localeCompare(b, "ar")),
      summary,
      insight: buildInsight(summary),
      rows,
    };
  } catch (error) {
    const message = databaseOfflineMessage(error) || "تعذر تحميل بيانات المناديب حالياً.";
    return {
      databaseStatus: "offline",
      databaseMessage: message,
      filters,
      cities: [],
      projects: [],
      supervisors: [],
      vehicles: [],
      accounts: [],
      nationalities: [],
      summary: {
        totalDrivers: 0,
        activeDrivers: 0,
        suspendedDrivers: 0,
        withoutSupervisor: 0,
        withoutVehicle: 0,
        withoutAppAccount: 0,
        monthOrders: 0,
        approvedAdvances: 0,
        pendingAdvances: 0,
      },
      insight: "لا يمكن إظهار تحليل دقيق قبل اتصال قاعدة البيانات.",
      rows: [],
    };
  }
}
