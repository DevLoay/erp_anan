import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage } from "@/lib/imports/templates";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateText(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function money(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return Number(value) || 0;
}

function housingKind(...values: Array<unknown>) {
  const text = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  if (text.includes("company") || text.includes("شركة")) return "company_housing";
  if (text.includes("external") || text.includes("خارجي") || text.includes("outside") || text.includes("self")) return "external_housing";
  if (text.includes("no_housing") || text.includes("بدون")) return "no_housing";
  return "";
}

function housingLabel(kind: string) {
  if (kind === "company_housing") return "سكن شركة";
  if (kind === "external_housing") return "سكن خارجي";
  if (kind === "no_housing") return "بدون سكن";
  return "غير محدد";
}

function impact(kind: string) {
  if (kind === "company_housing") return "لا يضاف بدل سكن في المسير";
  if (kind === "external_housing") return "يضاف بدل سكن حسب خطة الراتب";
  return "لا يوجد بدل سكن";
}

export type RiderHousingFilters = {
  q: string;
  cityId: string;
  applicationProjectId: string;
  housingType: string;
  status: string;
  driverId: string;
};

export type RiderHousingRow = {
  id: string;
  driverId: string;
  driverName: string;
  driverCode: string;
  nationalId: string;
  cityId: string;
  city: string;
  applicationProjectId: string;
  project: string;
  supervisor: string;
  housingType: string;
  housingLabel: string;
  accommodationType: string;
  location: string;
  roomNumber: string;
  monthlyCost: number;
  startDate: string;
  endDate: string;
  status: string;
  statusLabel: string;
  hasRecord: boolean;
  payrollImpact: string;
};

export type RiderHousingData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: RiderHousingFilters;
  summary: {
    totalDrivers: number;
    companyHousing: number;
    externalHousing: number;
    noHousing: number;
    activeRecords: number;
    totalMonthlyCost: number;
  };
  cities: { id: string; name: string }[];
  projects: { id: string; name: string; cityId: string }[];
  drivers: { id: string; name: string; cityId: string }[];
  rows: RiderHousingRow[];
  insight: string;
};

export function resolveRiderHousingFilters(params: SearchParams): RiderHousingFilters {
  return {
    q: one(params, "q").trim(),
    cityId: one(params, "cityId"),
    applicationProjectId: one(params, "applicationProjectId"),
    housingType: one(params, "housingType"),
    status: one(params, "status"),
    driverId: one(params, "driverId"),
  };
}

function emptyData(filters: RiderHousingFilters, message?: string): RiderHousingData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: { totalDrivers: 0, companyHousing: 0, externalHousing: 0, noHousing: 0, activeRecords: 0, totalMonthlyCost: 0 },
    cities: [],
    projects: [],
    drivers: [],
    rows: [],
    insight: "لا توجد بيانات كافية لتحليل سكن المناديب حالياً.",
  };
}

export async function getRiderHousingData(filters: RiderHousingFilters): Promise<RiderHousingData> {
  try {
    const driverWhere: Prisma.DriverWhereInput = {
      ...(filters.driverId ? { id: filters.driverId } : {}),
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.applicationProjectId ? { applicationAccounts: { some: { applicationProjectId: filters.applicationProjectId } } } : {}),
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
            ],
          }
        : {}),
    };

    const [drivers, cities, projects, driverRefs] = await Promise.all([
      prisma.driver.findMany({
        where: driverWhere,
        take: 800,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          supervisor: { select: { name: true } },
          housingRecords: { take: 1, orderBy: [{ status: "asc" }, { startDate: "desc" }] },
          applicationAccounts: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            include: { applicationProject: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.city.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.applicationProject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, cityId: true, application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } } }),
      prisma.driver.findMany({ orderBy: { name: "asc" }, take: 1000, select: { id: true, name: true, actualName: true, cityId: true, internalCode: true } }),
    ]);

    let rows: RiderHousingRow[] = drivers.map((driver) => {
      const record = driver.housingRecords[0] ?? null;
      const project = driver.applicationAccounts[0]?.applicationProject ?? null;
      const kind = housingKind(record?.housingType, driver.housingStatus, driver.accommodationType);
      return {
        id: record?.id || "",
        driverId: driver.id,
        driverName: driver.actualName || driver.name,
        driverCode: driver.internalCode || driver.driverCode || "-",
        nationalId: driver.nationalId || "-",
        cityId: driver.cityId || "",
        city: driver.city?.nameAr || driver.city?.nameEn || "-",
        applicationProjectId: project?.id || "",
        project: project?.name || "-",
        supervisor: driver.supervisor?.name || "-",
        housingType: kind || "no_housing",
        housingLabel: housingLabel(kind || "no_housing"),
        accommodationType: record?.accommodationType || driver.accommodationType || "-",
        location: record?.location || "-",
        roomNumber: record?.roomNumber || "-",
        monthlyCost: money(record?.monthlyCost),
        startDate: dateText(record?.startDate),
        endDate: dateText(record?.endDate),
        status: String(record?.status || (kind ? RecordStatus.ACTIVE : RecordStatus.INACTIVE)),
        statusLabel: record?.status === RecordStatus.ACTIVE || kind ? "نشط" : "غير مسجل",
        hasRecord: Boolean(record),
        payrollImpact: impact(kind || "no_housing"),
      };
    });

    if (filters.housingType) rows = rows.filter((row) => row.housingType === filters.housingType);
    if (filters.status) rows = rows.filter((row) => row.status === filters.status);

    const summary = {
      totalDrivers: rows.length,
      companyHousing: rows.filter((row) => row.housingType === "company_housing").length,
      externalHousing: rows.filter((row) => row.housingType === "external_housing").length,
      noHousing: rows.filter((row) => row.housingType === "no_housing").length,
      activeRecords: rows.filter((row) => row.hasRecord && row.status === RecordStatus.ACTIVE).length,
      totalMonthlyCost: rows.reduce((sum, row) => sum + row.monthlyCost, 0),
    };

    return {
      databaseStatus: "online",
      filters,
      summary,
      cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || "مدينة بدون اسم" })),
      projects: projects.map((project) => ({ id: project.id, name: project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim(), cityId: project.cityId || "" })),
      drivers: driverRefs.map((driver) => ({ id: driver.id, name: `${driver.actualName || driver.name} - ${driver.internalCode || ""}`.trim(), cityId: driver.cityId || "" })),
      rows,
      insight: summary.externalHousing
        ? `يوجد ${summary.externalHousing} مندوب سكن خارجي يستحق بدل السكن حسب خطة الراتب، و${summary.companyHousing} مندوب على سكن شركة لا يضاف لهم بدل سكن.`
        : "لا توجد سجلات سكن خارجي في الفلاتر الحالية.",
    };
  } catch (error) {
    return emptyData(filters, databaseOfflineMessage(error) || "تعذر تحميل بيانات سكن المناديب.");
  }
}
