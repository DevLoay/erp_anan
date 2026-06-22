import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdvancesPageFilters = {
  fromDate: string;
  toDate: string;
  applicationProjectId: string;
  cityId: string;
  supervisorId: string;
  driverId: string;
  deductionMonth: string;
  status: string;
  q: string;
  pageSize: number;
};

export type AdvanceRow = {
  id: string;
  referenceNumber: string;
  driverId: string;
  driverName: string;
  driverCode: string;
  projectId: string;
  projectName: string;
  cityId: string;
  cityName: string;
  supervisorId: string;
  supervisorName: string;
  advanceDate: string;
  deductionMonth: string;
  amount: number;
  remainingAmount: number;
  status: string;
  reason: string;
  createdBy: string;
  approvedBy: string;
  approvedAt: string;
  isDeducted: boolean;
  payrollRunLabel: string;
  payrollItemId: string;
  createdAt: string;
};

export type AdvancesPageData = {
  databaseOffline: boolean;
  filters: AdvancesPageFilters;
  rows: AdvanceRow[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    deducted: number;
    rejectedOrCancelled: number;
    totalAmount: number;
    approvedAmount: number;
    deductedAmount: number;
  };
  refs: {
    drivers: { id: string; name: string; internalCode: string; cityId: string; supervisorId: string; applicationProjectId: string }[];
    cities: { id: string; name: string }[];
    supervisors: { id: string; name: string; cityId: string }[];
    applicationProjects: { id: string; name: string; cityId: string; applicationName: string }[];
  };
};

function valueOf(param: string | string[] | undefined, fallback = "") {
  if (Array.isArray(param)) return param[0] ?? fallback;
  return param ?? fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function resolveAdvancesPageFilters(searchParams: Record<string, string | string[] | undefined>): AdvancesPageFilters {
  return {
    fromDate: valueOf(searchParams.fromDate, monthStart()),
    toDate: valueOf(searchParams.toDate, today()),
    applicationProjectId: valueOf(searchParams.applicationProjectId),
    cityId: valueOf(searchParams.cityId),
    supervisorId: valueOf(searchParams.supervisorId),
    driverId: valueOf(searchParams.driverId),
    deductionMonth: valueOf(searchParams.deductionMonth),
    status: valueOf(searchParams.status),
    q: valueOf(searchParams.q),
    pageSize: Math.min(Math.max(Number(valueOf(searchParams.pageSize, "25")) || 25, 10), 200),
  };
}

function toNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function monthLabel(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function empty(filters: AdvancesPageFilters, offline = false): AdvancesPageData {
  return {
    databaseOffline: offline,
    filters,
    rows: [],
    summary: {
      total: 0,
      pending: 0,
      approved: 0,
      deducted: 0,
      rejectedOrCancelled: 0,
      totalAmount: 0,
      approvedAmount: 0,
      deductedAmount: 0,
    },
    refs: { drivers: [], cities: [], supervisors: [], applicationProjects: [] },
  };
}

export async function getAdvancesPageData(filters: AdvancesPageFilters): Promise<AdvancesPageData> {
  try {
    const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00.000Z`) : undefined;
    const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999Z`) : undefined;
    const q = filters.q.trim();

    const and: Prisma.AdvanceWhereInput[] = [];
    if (from || to) and.push({ advanceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
    if (filters.status) and.push({ status: filters.status as never });
    if (filters.deductionMonth) and.push({ deductionMonth: filters.deductionMonth });
    if (filters.applicationProjectId) and.push({ applicationProjectId: filters.applicationProjectId });
    if (filters.cityId) and.push({ OR: [{ cityId: filters.cityId }, { driver: { cityId: filters.cityId } }] });
    if (filters.supervisorId) and.push({ OR: [{ supervisorId: filters.supervisorId }, { driver: { supervisorId: filters.supervisorId } }] });
    if (filters.driverId) and.push({ driverId: filters.driverId });
    if (q) {
      and.push({
        OR: [
          { referenceNumber: { contains: q, mode: "insensitive" as const } },
          { reason: { contains: q, mode: "insensitive" as const } },
          { driver: { name: { contains: q, mode: "insensitive" as const } } },
          { driver: { actualName: { contains: q, mode: "insensitive" as const } } },
          { driver: { internalCode: { contains: q, mode: "insensitive" as const } } },
          { driver: { driverCode: { contains: q, mode: "insensitive" as const } } },
          { driver: { phone: { contains: q, mode: "insensitive" as const } } },
          { driver: { nationalId: { contains: q, mode: "insensitive" as const } } },
          { applicationProject: { name: { contains: q, mode: "insensitive" as const } } },
          { supervisor: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      });
    }
    const where: Prisma.AdvanceWhereInput = and.length ? { AND: and } : {};

    const [advances, drivers, cities, supervisors, applicationProjects] = await Promise.all([
      prisma.advance.findMany({
        where,
        include: {
          driver: {
            include: {
              city: true,
              supervisor: true,
              applicationAccounts: {
                include: { applicationProject: { include: { application: true, city: true } } },
                orderBy: { updatedAt: "desc" },
                take: 1,
              },
            },
          },
          city: true,
          supervisor: true,
          applicationProject: { include: { application: true, city: true } },
          payrollItem: { include: { payrollRun: true } },
          deductedPayrollRun: true,
          createdBy: { select: { name: true, email: true } },
          approvedBy: { select: { name: true, email: true } },
        },
        orderBy: [{ advanceDate: "desc" }, { createdAt: "desc" }],
        take: filters.pageSize,
      }),
      prisma.driver.findMany({
        select: {
          id: true,
          name: true,
          internalCode: true,
          cityId: true,
          supervisorId: true,
          applicationAccounts: { select: { applicationProjectId: true }, take: 1 },
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
      prisma.supervisor.findMany({ select: { id: true, name: true, cityId: true }, orderBy: { name: "asc" } }),
      prisma.applicationProject.findMany({
        select: { id: true, name: true, cityId: true, application: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

    const rows: AdvanceRow[] = advances.map((advance) => {
      const fallbackAccount = advance.driver.applicationAccounts[0];
      const appProject = advance.applicationProject ?? fallbackAccount?.applicationProject ?? null;
      const city = advance.city ?? advance.driver.city ?? appProject?.city ?? null;
      const supervisor = advance.supervisor ?? advance.driver.supervisor ?? null;
      const linkedRun = advance.deductedPayrollRun ?? advance.payrollItem?.payrollRun ?? null;
      const amount = toNumber(advance.amount);
      const isDeducted = Boolean(advance.isDeducted || advance.payrollItemId || advance.deductedPayrollRunId || String(advance.status) === "DEDUCTED");
      return {
        id: advance.id,
        referenceNumber: advance.referenceNumber || "-",
        driverId: advance.driverId,
        driverName: advance.driver.actualName || advance.driver.name,
        driverCode: advance.driver.driverCode || advance.driver.internalCode,
        projectId: appProject?.id || "",
        projectName: appProject ? `${appProject.application?.name || ""} - ${appProject.name}`.trim() : "-",
        cityId: city?.id || "",
        cityName: city?.nameAr || city?.nameEn || "-",
        supervisorId: supervisor?.id || "",
        supervisorName: supervisor?.name || "-",
        advanceDate: dateOnly(advance.advanceDate || advance.createdAt),
        deductionMonth: advance.deductionMonth || "-",
        amount,
        remainingAmount: toNumber(advance.remainingAmount),
        status: String(advance.status),
        reason: advance.reason || "-",
        createdBy: advance.createdBy?.name || advance.createdBy?.email || "-",
        approvedBy: advance.approvedBy?.name || advance.approvedBy?.email || "-",
        approvedAt: dateOnly(advance.approvedAt),
        isDeducted,
        payrollRunLabel: linkedRun ? monthLabel(linkedRun.month, linkedRun.year) : "-",
        payrollItemId: advance.payrollItemId || "",
        createdAt: dateOnly(advance.createdAt),
      };
    });

    const summary = {
      total: rows.length,
      pending: rows.filter((row) => row.status === "PENDING").length,
      approved: rows.filter((row) => row.status === "APPROVED").length,
      deducted: rows.filter((row) => row.isDeducted || row.status === "DEDUCTED").length,
      rejectedOrCancelled: rows.filter((row) => ["REJECTED", "CANCELLED"].includes(row.status)).length,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      approvedAmount: rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.amount, 0),
      deductedAmount: rows.filter((row) => row.isDeducted || row.status === "DEDUCTED").reduce((sum, row) => sum + row.amount, 0),
    };

    return {
      databaseOffline: false,
      filters,
      rows,
      summary,
      refs: {
        drivers: drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          internalCode: driver.internalCode,
          cityId: driver.cityId || "",
          supervisorId: driver.supervisorId || "",
          applicationProjectId: driver.applicationAccounts[0]?.applicationProjectId || "",
        })),
        cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || "-" })),
        supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name, cityId: supervisor.cityId || "" })),
        applicationProjects: applicationProjects.map((project) => ({
          id: project.id,
          name: `${project.application.name} - ${project.name}`,
          cityId: project.cityId || "",
          applicationName: project.application.name,
        })),
      },
    };
  } catch {
    return empty(filters, true);
  }
}
