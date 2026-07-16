import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/auth/accessScope";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { ADMIN_PROFILE_PREFIX } from "@/lib/auth/userPermissionProfile";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function parseDate(value: string, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function statusText(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (status === "ACTIVE" || status === "active") return "نشط";
  if (status === "SUSPENDED") return "موقوف";
  if (status === "INACTIVE" || status === "inactive") return "تم إنهاء / غير نشط";
  if (status === "PENDING") return "قيد المراجعة";
  return String(value ?? "-") || "-";
}

function statusTone(value: unknown): "emerald" | "amber" | "red" | "slate" {
  const status = String(value ?? "").toUpperCase();
  if (status === "ACTIVE" || status === "active") return "emerald";
  if (status === "SUSPENDED" || status === "PENDING") return "amber";
  if (status === "INACTIVE" || status === "inactive") return "red";
  return "slate";
}

function personTypeText(type: HrPersonType) {
  if (type === "driver") return "مندوب";
  if (type === "supervisor") return "مشرف";
  return "موظف إداري";
}

function documentStatus(documents: Array<{ expiryDate: Date | null; verificationStatus: string | null }>) {
  if (!documents.length) return "ناقص مستندات";
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setDate(now.getDate() + 30);
  const expired = documents.some((item) => item.expiryDate && item.expiryDate < now);
  if (expired) return "منتهي";
  const expiring = documents.some((item) => item.expiryDate && item.expiryDate <= nextMonth);
  if (expiring) return "ينتهي قريبًا";
  const pending = documents.some((item) => String(item.verificationStatus ?? "").toLowerCase() === "pending");
  if (pending) return "قيد المراجعة";
  return "مكتمل";
}

function attendanceStatus(record?: { checkIn: Date | null; checkOut: Date | null; status: unknown } | null) {
  if (!record) return "لا يوجد حضور اليوم";
  if (record.checkIn && record.checkOut) return "حضور وانصراف";
  if (record.checkIn) return "حاضر";
  return statusText(record.status);
}

function textDate(value?: Date | null) {
  return value ? dateInput(value) : "-";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function profileText(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function emptyData(filters: HrFilters, message?: string): HumanResourcesData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: {
      total: 0,
      adminUsers: 0,
      drivers: 0,
      supervisors: 0,
      sponsored: 0,
      freelancers: 0,
      active: 0,
      inactive: 0,
      missingDocuments: 0,
      expiringDocuments: 0,
      companyHousing: 0,
      externalHousing: 0,
      attendanceToday: 0,
    },
    cities: [],
    projects: [],
    supervisors: [],
    nationalities: [],
    rows: [],
    insight: "لا توجد بيانات كافية لإظهار تحليل الموارد البشرية حاليًا.",
  };
}

export type HrPersonType = "user" | "supervisor" | "driver";

export type HrFilters = {
  tab: string;
  q: string;
  personType: string;
  cityId: string;
  applicationProjectId: string;
  supervisorId: string;
  contractType: string;
  sponsorshipType: string;
  housingStatus: string;
  nationality: string;
  status: string;
  documentStatus: string;
  attendanceStatus: string;
  fromDate: string;
  toDate: string;
};

export type HrRow = {
  id: string;
  type: HrPersonType;
  typeLabel: string;
  name: string;
  internalCode: string;
  driverCode: string;
  phone: string;
  nationalId: string;
  nationality: string;
  cityId: string;
  city: string;
  project: string;
  applicationProjectId: string;
  application: string;
  supervisorId: string;
  supervisor: string;
  contractType: string;
  sponsorshipType: string;
  housingStatus: string;
  attendanceStatus: string;
  documentStatus: string;
  status: string;
  statusLabel: string;
  statusTone: "emerald" | "amber" | "red" | "slate";
  joinDate: string;
  lastAttendanceDate: string;
  payrollLink: string;
  operationsLink: string;
  adminLink: string;
  canAssignSupervisor: boolean;
  needsReview: boolean;
};

export type HumanResourcesData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: HrFilters;
  summary: {
    total: number;
    adminUsers: number;
    drivers: number;
    supervisors: number;
    sponsored: number;
    freelancers: number;
    active: number;
    inactive: number;
    missingDocuments: number;
    expiringDocuments: number;
    companyHousing: number;
    externalHousing: number;
    attendanceToday: number;
  };
  cities: { id: string; name: string }[];
  projects: { id: string; name: string; cityId: string }[];
  supervisors: { id: string; name: string; cityId: string }[];
  nationalities: string[];
  rows: HrRow[];
  insight: string;
};

export function resolveHumanResourcesFilters(params: SearchParams): HrFilters {
  const now = new Date();
  return {
    tab: one(params, "tab") || "all",
    q: one(params, "q").trim(),
    personType: one(params, "personType"),
    cityId: one(params, "cityId"),
    applicationProjectId: one(params, "applicationProjectId"),
    supervisorId: one(params, "supervisorId"),
    contractType: one(params, "contractType"),
    sponsorshipType: one(params, "sponsorshipType"),
    housingStatus: one(params, "housingStatus"),
    nationality: one(params, "nationality"),
    status: one(params, "status"),
    documentStatus: one(params, "documentStatus"),
    attendanceStatus: one(params, "attendanceStatus"),
    fromDate: one(params, "fromDate") || dateInput(monthStart(now)),
    toDate: one(params, "toDate") || dateInput(now),
  };
}

function isCompanyHousing(value: string) {
  const text = value.toLowerCase();
  return text.includes("company") || text.includes("شركة") || text.includes("company_housing");
}

function isExternalHousing(value: string) {
  const text = value.toLowerCase();
  return text.includes("external") || text.includes("خارجي") || text.includes("outside") || text.includes("self");
}

function buildInsight(summary: HumanResourcesData["summary"]) {
  if (!summary.total) return "لا توجد بيانات موارد بشرية كافية حاليًا.";
  const parts: string[] = [];
  if (summary.missingDocuments) parts.push(`${summary.missingDocuments} ملف يحتاج مستندات`);
  if (summary.companyHousing) parts.push(`${summary.companyHousing} مندوب على سكن شركة بدون بدل سكن`);
  if (summary.externalHousing) parts.push(`${summary.externalHousing} مندوب سكن خارجي يستحق بدل السكن حسب خطة الراتب`);
  if (summary.inactive) parts.push(`${summary.inactive} شخص موقوف أو منتهي`);
  return parts.length ? parts.join("، ") + "." : "بيانات الموارد البشرية مستقرة ولا توجد فجوات ظاهرة في الفلاتر الحالية.";
}

export async function getHumanResourcesData(filters: HrFilters, accessScope?: AccessScope): Promise<HumanResourcesData> {
  try {
    const fromDate = parseDate(filters.fromDate, monthStart(new Date()));
    const toDate = parseDate(filters.toDate, new Date());
    toDate.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const driverFilterWhere: Prisma.DriverWhereInput = {
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.applicationProjectId ? { applicationAccounts: { some: { applicationProjectId: filters.applicationProjectId } } } : {}),
      ...(filters.supervisorId ? { supervisorId: filters.supervisorId } : {}),
      ...(filters.status ? { status: filters.status as Prisma.EnumDriverStatusFilter["equals"] } : {}),
      ...(filters.nationality ? { nationality: filters.nationality } : {}),
      ...(filters.contractType ? { contractType: { contains: filters.contractType, mode: "insensitive" } } : {}),
      ...(filters.sponsorshipType ? { sponsorshipType: { contains: filters.sponsorshipType, mode: "insensitive" } } : {}),
      ...(filters.housingStatus ? { housingStatus: { contains: filters.housingStatus, mode: "insensitive" } } : {}),
      ...(filters.fromDate || filters.toDate ? { OR: [{ joinDate: null }, { joinDate: { lte: toDate } }] } : {}),
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
            ],
          }
        : {}),
    };
    const driverScopeWhere: Prisma.DriverWhereInput =
      accessScope && !accessScope.isGlobal
        ? {
            AND: [
              accessScope.cityIds.length ? { cityId: { in: accessScope.cityIds } } : {},
              accessScope.projectIds.length
                ? { applicationAccounts: { some: { applicationProjectId: { in: accessScope.projectIds } } } }
                : {},
              accessScope.driverId ? { id: accessScope.driverId } : {},
            ],
          }
        : {};
    const driverWhere: Prisma.DriverWhereInput = { AND: [driverScopeWhere, driverFilterWhere] };

    const userFilterWhere: Prisma.UserWhereInput = {
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.applicationProjectId ? { projectScope: { contains: filters.applicationProjectId } } : {}),
      ...(filters.status ? { status: filters.status.toLowerCase() } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const userScopeWhere: Prisma.UserWhereInput =
      accessScope && !accessScope.isGlobal
        ? {
            AND: [
              accessScope.cityIds.length
                ? { OR: [{ cityId: { in: accessScope.cityIds } }, { supervisor: { is: { cityId: { in: accessScope.cityIds } } } }] }
                : {},
              accessScope.projectIds.length
                ? {
                    OR: [
                      { id: accessScope.userId },
                      ...accessScope.projectIds.map((projectId) => ({ projectScope: { contains: projectId } })),
                    ],
                  }
                : {},
            ],
          }
        : {};
    const userWhere: Prisma.UserWhereInput = { AND: [userScopeWhere, userFilterWhere] };

    const supervisorFilterWhere: Prisma.SupervisorWhereInput = {
      ...(filters.cityId ? { cityId: filters.cityId } : {}),
      ...(filters.status ? { status: filters.status as Prisma.EnumRecordStatusFilter["equals"] } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const supervisorScopeWhere: Prisma.SupervisorWhereInput =
      accessScope && !accessScope.isGlobal
        ? accessScope.projectIds.length && accessScope.supervisorId
          ? { id: accessScope.supervisorId }
          : accessScope.cityIds.length
            ? { cityId: { in: accessScope.cityIds } }
            : { id: "__NO_ACCESS__" }
        : {};
    const supervisorWhere: Prisma.SupervisorWhereInput = { AND: [supervisorScopeWhere, supervisorFilterWhere] };

    const cityWhere: Prisma.CityWhereInput =
      accessScope && !accessScope.isGlobal && accessScope.cityIds.length ? { id: { in: accessScope.cityIds } } : {};
    const projectWhere: Prisma.ApplicationProjectWhereInput = {
      AND: [
        accessScope && !accessScope.isGlobal && accessScope.projectIds.length ? { id: { in: accessScope.projectIds } } : {},
        accessScope && !accessScope.isGlobal && accessScope.cityIds.length ? { cityId: { in: accessScope.cityIds } } : {},
      ],
    };

    const [drivers, users, supervisors, cities, projects, supervisorRefs, nationalities, adminProfileSettings] = await Promise.all([
      prisma.driver.findMany({
        where: driverWhere,
        take: 700,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          supervisor: { select: { id: true, name: true } },
          applicationAccounts: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            include: {
              application: { select: { name: true, code: true } },
              applicationProject: { select: { id: true, name: true } },
            },
          },
          documents: { select: { expiryDate: true, verificationStatus: true } },
          contracts: { take: 1, orderBy: { updatedAt: "desc" }, select: { contractType: true, sponsor: true, endDate: true, status: true } },
          housingRecords: { take: 1, where: { status: "ACTIVE" }, orderBy: { startDate: "desc" }, select: { housingType: true, accommodationType: true, location: true, status: true } },
          attendanceRecords: { take: 1, where: { workDate: { gte: todayStart, lte: todayEnd } }, orderBy: { workDate: "desc" }, select: { workDate: true, checkIn: true, checkOut: true, status: true } },
          payrollItems: { take: 1, orderBy: { updatedAt: "desc" }, select: { payrollRunId: true } },
        },
      }),
      prisma.user.findMany({
        where: userWhere,
        take: 300,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          attendanceRecords: { take: 1, where: { workDate: { gte: todayStart, lte: todayEnd } }, orderBy: { workDate: "desc" }, select: { workDate: true, checkIn: true, checkOut: true, status: true } },
        },
      }),
      prisma.supervisor.findMany({
        where: supervisorWhere,
        take: 300,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          city: { select: { id: true, nameAr: true, nameEn: true } },
          attendanceRecords: { take: 1, where: { workDate: { gte: todayStart, lte: todayEnd } }, orderBy: { workDate: "desc" }, select: { workDate: true, checkIn: true, checkOut: true, status: true } },
        },
      }),
      prisma.city.findMany({ where: cityWhere, orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.applicationProject.findMany({ where: projectWhere, orderBy: [{ application: { name: "asc" } }, { name: "asc" }], select: { id: true, name: true, cityId: true, application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } } }),
      prisma.supervisor.findMany({ where: supervisorScopeWhere, orderBy: { name: "asc" }, select: { id: true, name: true, cityId: true } }),
      prisma.driver.findMany({ distinct: ["nationality"], where: { AND: [driverScopeWhere, { nationality: { not: null } }] }, select: { nationality: true }, take: 200 }),
      prisma.systemSetting.findMany({
        where: { key: { startsWith: ADMIN_PROFILE_PREFIX } },
        select: { key: true, value: true },
      }),
    ]);

    const adminProfiles = new Map(
      adminProfileSettings.map((setting) => [
        setting.key.slice(ADMIN_PROFILE_PREFIX.length),
        objectValue(setting.value),
      ]),
    );

    let rows: HrRow[] = [];

    if (!filters.personType || filters.personType === "driver") {
      rows.push(
        ...drivers.map((driver) => {
          const account = driver.applicationAccounts[0] ?? null;
          const housing = driver.housingRecords[0] ?? null;
          const housingStatus = driver.housingStatus || housing?.housingType || driver.accommodationType || "-";
          const docs = documentStatus(driver.documents);
          const attendance = attendanceStatus(driver.attendanceRecords[0]);
          return {
            id: driver.id,
            type: "driver" as const,
            typeLabel: personTypeText("driver"),
            name: driver.actualName || driver.name,
            internalCode: driver.internalCode || "-",
            driverCode: driver.driverCode || driver.internalCode || "-",
            phone: driver.mobile || driver.phone || "-",
            nationalId: driver.nationalId || "-",
            nationality: driver.nationality || "-",
            cityId: driver.cityId || "",
            city: driver.city?.nameAr || driver.city?.nameEn || "-",
            project: account?.applicationProject?.name || "-",
            applicationProjectId: account?.applicationProject?.id || account?.applicationProjectId || "",
            application: account?.application?.name || account?.appName || "-",
            supervisorId: driver.supervisorId || "",
            supervisor: driver.supervisor?.name || "-",
            contractType: driver.contractType || driver.contracts[0]?.contractType || "-",
            sponsorshipType: driver.sponsorshipType || driver.contracts[0]?.sponsor || "-",
            housingStatus,
            attendanceStatus: attendance,
            documentStatus: docs,
            status: String(driver.status),
            statusLabel: statusText(driver.status),
            statusTone: statusTone(driver.status),
            joinDate: textDate(driver.joinDate),
            lastAttendanceDate: textDate(driver.attendanceRecords[0]?.workDate),
            payrollLink: driver.payrollItems[0]?.payrollRunId ? `/payroll?driverId=${driver.id}` : `/payroll?driverId=${driver.id}`,
            operationsLink: `/drivers/${driver.id}`,
            adminLink: `/rider-documents?driverId=${driver.id}`,
            canAssignSupervisor: true,
            needsReview: driver.needsReview || docs !== "مكتمل" || housingStatus === "-",
          };
        }),
      );
    }

    if (!filters.personType || filters.personType === "user") {
      rows.push(
        ...users.map((user) => {
          const profile = adminProfiles.get(user.id);
          const applicationProjectId = profileText(profile, "applicationProjectId") || user.projectScope?.split(",")[0]?.trim() || "";
          const project = projects.find((item) => item.id === applicationProjectId);
          return {
            id: user.id,
            type: "user" as const,
            typeLabel: personTypeText("user"),
            name: user.name,
            internalCode: user.email,
            driverCode: "-",
            phone: profileText(profile, "phone") || "-",
            nationalId: "-",
            nationality: "-",
            cityId: profileText(profile, "cityId") || user.cityId || project?.cityId || "",
            city: user.city?.nameAr || user.city?.nameEn || project?.city?.nameAr || project?.city?.nameEn || "-",
            project: profileText(profile, "applicationProjectName") || project?.name || "-",
            applicationProjectId,
            application: profileText(profile, "applicationName") || project?.application.name || "-",
            supervisorId: user.supervisorId || "",
            supervisor: "-",
            contractType: profileText(profile, "jobTitle") || String(user.role),
            sponsorshipType: "-",
            housingStatus: "-",
            attendanceStatus: attendanceStatus(user.attendanceRecords[0]),
            documentStatus: "-",
            status: user.status,
            statusLabel: user.isActive ? "نشط" : "غير نشط",
            statusTone: user.isActive ? ("emerald" as const) : ("red" as const),
            joinDate: textDate(user.createdAt),
            lastAttendanceDate: textDate(user.attendanceRecords[0]?.workDate),
            payrollLink: "/payroll",
            operationsLink: "/users",
            adminLink: `/users?userId=${user.id}`,
            canAssignSupervisor: false,
            needsReview: !user.isActive || !profile,
          };
        }),
      );
    }

    if (!filters.personType || filters.personType === "supervisor") {
      rows.push(
        ...supervisors.map((supervisor) => ({
          id: supervisor.id,
          type: "supervisor" as const,
          typeLabel: personTypeText("supervisor"),
          name: supervisor.name,
          internalCode: supervisor.email || supervisor.phone || supervisor.id,
          driverCode: "-",
          phone: supervisor.phone || "-",
          nationalId: "-",
          nationality: "-",
          cityId: supervisor.cityId || "",
          city: supervisor.city?.nameAr || supervisor.city?.nameEn || "-",
          project: "-",
          applicationProjectId: "",
          application: "-",
          supervisorId: supervisor.id,
          supervisor: supervisor.name,
          contractType: "Supervisor",
          sponsorshipType: "-",
          housingStatus: "-",
          attendanceStatus: attendanceStatus(supervisor.attendanceRecords[0]),
          documentStatus: "-",
          status: String(supervisor.status),
          statusLabel: statusText(supervisor.status),
          statusTone: statusTone(supervisor.status),
          joinDate: textDate(supervisor.createdAt),
          lastAttendanceDate: textDate(supervisor.attendanceRecords[0]?.workDate),
          payrollLink: "/payroll",
          operationsLink: "/supervisors",
          adminLink: `/supervisors?supervisorId=${supervisor.id}`,
          canAssignSupervisor: false,
          needsReview: false,
        })),
      );
    }

    if (filters.tab && filters.tab !== "all") {
      rows = rows.filter((row) => {
        if (filters.tab === "drivers") return row.type === "driver";
        if (filters.tab === "supervisors") return row.type === "supervisor";
        if (filters.tab === "admin") return row.type === "user";
        if (filters.tab === "sponsored") return row.sponsorshipType !== "-" && !row.sponsorshipType.toLowerCase().includes("freelance");
        if (filters.tab === "freelancers") return row.contractType.toLowerCase().includes("freelance") || row.sponsorshipType.toLowerCase().includes("freelance") || row.contractType.includes("فري");
        if (filters.tab === "housing") return row.housingStatus !== "-";
        if (filters.tab === "attendance") return row.attendanceStatus !== "لا يوجد حضور اليوم";
        if (filters.tab === "documents") return row.documentStatus !== "-" && row.documentStatus !== "مكتمل";
        return true;
      });
    }

    if (filters.documentStatus) rows = rows.filter((row) => row.documentStatus === filters.documentStatus);
    if (filters.attendanceStatus) rows = rows.filter((row) => row.attendanceStatus === filters.attendanceStatus);

    const summary = {
      total: rows.length,
      adminUsers: rows.filter((row) => row.type === "user").length,
      drivers: rows.filter((row) => row.type === "driver").length,
      supervisors: rows.filter((row) => row.type === "supervisor").length,
      sponsored: rows.filter((row) => row.sponsorshipType !== "-" && !row.sponsorshipType.toLowerCase().includes("freelance")).length,
      freelancers: rows.filter((row) => row.contractType.toLowerCase().includes("freelance") || row.sponsorshipType.toLowerCase().includes("freelance") || row.contractType.includes("فري")).length,
      active: rows.filter((row) => row.statusTone === "emerald").length,
      inactive: rows.filter((row) => row.statusTone === "red").length,
      missingDocuments: rows.filter((row) => row.documentStatus === "ناقص مستندات").length,
      expiringDocuments: rows.filter((row) => row.documentStatus === "ينتهي قريبًا" || row.documentStatus === "منتهي").length,
      companyHousing: rows.filter((row) => isCompanyHousing(row.housingStatus)).length,
      externalHousing: rows.filter((row) => isExternalHousing(row.housingStatus)).length,
      attendanceToday: rows.filter((row) => row.attendanceStatus === "حاضر" || row.attendanceStatus === "حضور وانصراف").length,
    };

    return {
      databaseStatus: "online",
      filters,
      summary,
      cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || "مدينة بدون اسم" })),
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim(),
        cityId: project.cityId || "",
      })),
      supervisors: supervisorRefs.map((supervisor) => ({ id: supervisor.id, name: supervisor.name, cityId: supervisor.cityId || "" })),
      nationalities: nationalities.map((item) => item.nationality).filter((item): item is string => Boolean(item)).sort((a, b) => a.localeCompare(b, "ar")),
      rows,
      insight: buildInsight(summary),
    };
  } catch (error) {
    const message = databaseOfflineMessage(error) || "تعذر تحميل بيانات الموارد البشرية حاليًا.";
    return emptyData(filters, message);
  }
}
