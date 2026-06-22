import { Prisma, RecordStatus } from "@prisma/client";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";
import { prisma } from "@/lib/prisma";

export type DriverViolationFilters = {
  q: string;
  fromDate: string;
  toDate: string;
  cityId: string;
  applicationProjectId: string;
  supervisorId: string;
  driverId: string;
  status: string;
  type: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type DriverViolationRow = {
  id: string;
  driverId: string;
  driverName: string;
  driverCode: string;
  nationalId: string;
  mobile: string;
  cityName: string;
  supervisorName: string;
  projectName: string;
  applicationName: string;
  vehiclePlate: string;
  type: string;
  amount: number;
  status: string;
  occurredAt: string;
  notes: string;
  notificationCount: number;
};

export type ViolationOption = {
  id: string;
  label: string;
};

export type DriverViolationsPageData = {
  databaseOffline: boolean;
  filters: DriverViolationFilters;
  rows: DriverViolationRow[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    deducted: number;
    totalAmount: number;
    notified: number;
  };
  options: {
    drivers: ViolationOption[];
    cities: ViolationOption[];
    supervisors: ViolationOption[];
    applicationProjects: ViolationOption[];
    types: string[];
    statuses: string[];
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pages: number;
  };
};

const defaultStatuses = ["PENDING", "APPROVED", "DEDUCTED", "REJECTED", "CANCELLED"];
const defaultTypes = ["مخالفة تشغيلية", "مخالفة مرورية", "مخالفة تطبيق", "خصم يدوي", "تحذير"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function toStartDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function toEndDate(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`) : undefined;
}

function decimalNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function canSeeDriver(scope: AccessScope, driver: {
  id: string;
  cityId: string | null;
  supervisorId: string | null;
  applicationAccounts: { applicationProjectId: string | null }[];
}) {
  if (scope.isGlobal) return true;
  if (scope.driverId && scope.driverId === driver.id) return true;
  if (scope.supervisorId && scope.supervisorId === driver.supervisorId) return true;
  if (driver.cityId && scope.cityIds.includes(driver.cityId)) return true;
  return driver.applicationAccounts.some((account) => account.applicationProjectId && scope.projectIds.includes(account.applicationProjectId));
}

function accessWhere(scope: AccessScope): Prisma.ViolationWhereInput {
  if (scope.isGlobal) return {};
  const or: Prisma.ViolationWhereInput[] = [];
  if (scope.driverId) or.push({ driverId: scope.driverId });
  if (scope.supervisorId) or.push({ driver: { supervisorId: scope.supervisorId } });
  if (scope.cityIds.length) or.push({ driver: { cityId: { in: scope.cityIds } } });
  if (scope.projectIds.length) or.push({ driver: { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } } });
  return or.length ? { OR: or } : { id: "__NO_ACCESS_SCOPE__" };
}

function buildWhere(filters: DriverViolationFilters, scope: AccessScope): Prisma.ViolationWhereInput {
  const q = filters.q.trim();
  const dateFrom = toStartDate(filters.fromDate);
  const dateTo = toEndDate(filters.toDate);
  const and: Prisma.ViolationWhereInput[] = [accessWhere(scope)];

  if (dateFrom || dateTo) and.push({ occurredAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } });
  if (filters.status) and.push({ status: filters.status as RecordStatus });
  if (filters.type) and.push({ type: { contains: filters.type, mode: "insensitive" } });
  if (filters.driverId) and.push({ driverId: filters.driverId });
  if (filters.cityId) and.push({ driver: { cityId: filters.cityId } });
  if (filters.supervisorId) and.push({ driver: { supervisorId: filters.supervisorId } });
  if (filters.applicationProjectId) and.push({ driver: { applicationAccounts: { some: { applicationProjectId: filters.applicationProjectId } } } });
  if (q) {
    and.push({
      OR: [
        { type: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { driver: { name: { contains: q, mode: "insensitive" } } },
        { driver: { actualName: { contains: q, mode: "insensitive" } } },
        { driver: { internalCode: { contains: q, mode: "insensitive" } } },
        { driver: { driverCode: { contains: q, mode: "insensitive" } } },
        { driver: { nationalId: { contains: q, mode: "insensitive" } } },
        { driver: { phone: { contains: q, mode: "insensitive" } } },
        { vehicle: { plateArabic: { contains: q, mode: "insensitive" } } },
        { vehicle: { plateEnglish: { contains: q, mode: "insensitive" } } },
        { vehicle: { plateEn: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: and };
}

function orderBy(filters: DriverViolationFilters): Prisma.ViolationOrderByWithRelationInput {
  const dir = filters.dir;
  if (filters.sort === "driver") return { driver: { name: dir } };
  if (filters.sort === "amount") return { amount: dir };
  if (filters.sort === "status") return { status: dir };
  if (filters.sort === "type") return { type: dir };
  return { occurredAt: dir };
}

export function resolveDriverViolationFilters(params: Record<string, string | string[] | undefined>): DriverViolationFilters {
  const pageSize = Math.min(Math.max(Number(one(params.pageSize) || 25), 10), 100);
  const sort = one(params.sort) || "occurredAt";
  const dir = one(params.dir) === "asc" ? "asc" : "desc";
  return {
    q: one(params.q),
    fromDate: one(params.fromDate) || firstDayOfMonth(),
    toDate: one(params.toDate) || todayDate(),
    cityId: one(params.cityId),
    applicationProjectId: one(params.applicationProjectId),
    supervisorId: one(params.supervisorId),
    driverId: one(params.driverId),
    status: one(params.status),
    type: one(params.type),
    sort,
    dir,
    page: Math.max(Number(one(params.page) || 1), 1),
    pageSize,
  };
}

export async function getDriverViolationsPageData(filters: DriverViolationFilters, headers: Headers): Promise<DriverViolationsPageData> {
  try {
    const scope = await getAccessScope(headers);
    const where = buildWhere(filters, scope);
    const skip = (filters.page - 1) * filters.pageSize;
    const take = filters.pageSize;

    const [rows, total, aggregate, pending, approved, deducted, notifications, drivers, cities, supervisors, applicationProjects, types] = await Promise.all([
      prisma.violation.findMany({
        where,
        include: {
          driver: {
            include: {
              city: { select: { nameAr: true, nameEn: true } },
              supervisor: { select: { name: true } },
              applicationAccounts: {
                include: {
                  application: { select: { name: true, code: true } },
                  applicationProject: { select: { name: true, code: true } },
                },
                take: 3,
              },
            },
          },
          vehicle: { select: { plateArabic: true, plateAr: true, plateEnglish: true, plateEn: true } },
        },
        orderBy: orderBy(filters),
        skip,
        take,
      }),
      prisma.violation.count({ where }),
      prisma.violation.aggregate({ where, _sum: { amount: true } }),
      prisma.violation.count({ where: { ...where, status: "PENDING" } }),
      prisma.violation.count({ where: { ...where, status: "APPROVED" } }),
      prisma.violation.count({ where: { ...where, status: "DEDUCTED" } }),
      prisma.notification.findMany({
        where: { entityType: { in: ["Violation", "DriverWarning"] } },
        select: { entityId: true },
      }),
      prisma.driver.findMany({
        include: { applicationAccounts: { select: { applicationProjectId: true } }, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.city.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.supervisor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.applicationProject.findMany({
        include: { application: { select: { name: true, code: true } }, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.violation.findMany({ select: { type: true }, distinct: ["type"], orderBy: { type: "asc" } }),
    ]);

    const notificationCounts = new Map<string, number>();
    notifications.forEach((row) => {
      if (!row.entityId) return;
      notificationCounts.set(row.entityId, (notificationCounts.get(row.entityId) ?? 0) + 1);
    });

    const visibleDrivers = drivers.filter((driver) => canSeeDriver(scope, driver));
    const visibleProjectIds = new Set(visibleDrivers.flatMap((driver) => driver.applicationAccounts.map((account) => account.applicationProjectId).filter(Boolean) as string[]));

    return {
      databaseOffline: false,
      filters,
      rows: rows.map((row) => {
        const account = row.driver.applicationAccounts[0];
        return {
          id: row.id,
          driverId: row.driverId,
          driverName: row.driver.actualName || row.driver.name,
          driverCode: row.driver.driverCode || row.driver.internalCode,
          nationalId: row.driver.nationalId || "-",
          mobile: row.driver.mobile || row.driver.phone || "-",
          cityName: row.driver.city?.nameAr || row.driver.city?.nameEn || "-",
          supervisorName: row.driver.supervisor?.name || "-",
          projectName: account?.applicationProject?.name || account?.applicationProject?.code || "-",
          applicationName: account?.application?.name || account?.application?.code || "-",
          vehiclePlate: row.vehicle?.plateArabic || row.vehicle?.plateAr || row.vehicle?.plateEnglish || row.vehicle?.plateEn || "-",
          type: row.type,
          amount: decimalNumber(row.amount),
          status: row.status,
          occurredAt: row.occurredAt.toISOString(),
          notes: row.notes || "",
          notificationCount: notificationCounts.get(row.id) ?? 0,
        };
      }),
      summary: {
        total,
        pending,
        approved,
        deducted,
        totalAmount: decimalNumber(aggregate._sum.amount),
        notified: rows.filter((row) => notificationCounts.has(row.id)).length,
      },
      options: {
        drivers: visibleDrivers.map((driver) => ({
          id: driver.id,
          label: `${driver.actualName || driver.name} - ${driver.driverCode || driver.internalCode}${driver.city ? ` - ${driver.city.nameAr || driver.city.nameEn}` : ""}`,
        })),
        cities: cities
          .filter((city) => scope.isGlobal || !scope.cityIds.length || scope.cityIds.includes(city.id))
          .map((city) => ({ id: city.id, label: city.nameAr || city.nameEn || city.id })),
        supervisors: supervisors
          .filter((supervisor) => scope.isGlobal || !scope.supervisorId || supervisor.id === scope.supervisorId)
          .map((supervisor) => ({ id: supervisor.id, label: supervisor.name })),
        applicationProjects: applicationProjects
          .filter((project) => scope.isGlobal || visibleProjectIds.has(project.id) || scope.projectIds.includes(project.id))
          .map((project) => ({
            id: project.id,
            label: `${project.application?.name || project.application?.code || ""} - ${project.name} ${project.city ? `- ${project.city.nameAr || project.city.nameEn}` : ""}`.trim(),
          })),
        types: [...new Set([...defaultTypes, ...types.map((item) => item.type).filter(Boolean)])],
        statuses: defaultStatuses,
      },
      pagination: {
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        pages: Math.max(Math.ceil(total / filters.pageSize), 1),
      },
    };
  } catch {
    return {
      databaseOffline: true,
      filters,
      rows: [],
      summary: { total: 0, pending: 0, approved: 0, deducted: 0, totalAmount: 0, notified: 0 },
      options: { drivers: [], cities: [], supervisors: [], applicationProjects: [], types: defaultTypes, statuses: defaultStatuses },
      pagination: { total: 0, page: filters.page, pageSize: filters.pageSize, pages: 1 },
    };
  }
}
