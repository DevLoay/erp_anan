import { prisma } from "@/lib/prisma";
import {
  USER_PERMISSION_PROFILE_PREFIX,
  parseUserPermissionProfile,
} from "@/lib/auth/userPermissionProfile";

type SearchParams = Record<string, string | string[] | undefined>;

export type UserManagementFilters = {
  q: string;
  fromDate: string;
  toDate: string;
  role: string;
  status: string;
  cityId: string;
  supervisorId: string;
};

export type UserManagementRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  statusLabel: string;
  statusTone: "emerald" | "red" | "amber" | "slate";
  lastLogin: string;
  device: string;
  cityScope: string;
  projectScope: string;
  supervisorName: string;
  linkedDriversCount: number;
  permissionsSummary: string;
  cityId: string;
  supervisorId: string;
  driverId: string;
  cityScopeRaw: string;
  projectScopeRaw: string;
  isActive: boolean;
};

export type ScopeIssueRow = {
  id: string;
  title: string;
  value: number;
  description: string;
  tone: "emerald" | "amber" | "red" | "blue";
};

export type UserManagementData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: UserManagementFilters;
  roles: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  cities: { id: string; name: string }[];
  supervisors: { id: string; name: string; cityName: string; cityId: string }[];
  drivers: { id: string; name: string; code: string; cityId: string; supervisorId: string }[];
  projects: { id: string; name: string }[];
  summary: {
    users: number;
    active: number;
    inactive: number;
    auditLogs: number;
  };
  scopeIssues: ScopeIssueRow[];
  rows: UserManagementRow[];
};

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  OPERATION_MANAGER: "Operations Manager",
  SUPERVISOR: "Supervisor",
  ACCOUNTANT: "Accountant",
  HR: "HR",
  VIEWER: "Viewer",
};

const permissionLabels: Record<string, string> = {
  ADMIN: "كل المدن، كل المناديب، كل الصلاحيات",
  OPERATION_MANAGER: "التشغيل، المدن، المشرفين، التقارير",
  SUPERVISOR: "مناديبه ومهامه وتنبيهات فريقه",
  ACCOUNTANT: "الماليات والمسير والصرف",
  HR: "المناديب، الموارد البشرية، المستندات",
  VIEWER: "عرض فقط بدون تعديل",
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

export async function resolveUserManagementFilters(searchParams: SearchParams): Promise<UserManagementFilters> {
  return {
    q: first(searchParams.q).trim(),
    fromDate: first(searchParams.fromDate) || defaultFromDate(),
    toDate: first(searchParams.toDate) || isoDate(new Date()),
    role: first(searchParams.role),
    status: first(searchParams.status),
    cityId: first(searchParams.cityId),
    supervisorId: first(searchParams.supervisorId),
  };
}

function displayDate(value?: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function displayStatus(status: string, isActive: boolean) {
  const normalized = status.toLowerCase();
  if (isActive && ["active", "نشط"].includes(normalized)) return { label: "نشط", tone: "emerald" as const };
  if (!isActive || ["inactive", "suspended", "locked", "موقوف"].includes(normalized)) return { label: "موقوف", tone: "red" as const };
  if (["pending"].includes(normalized)) return { label: "قيد المراجعة", tone: "amber" as const };
  return { label: status || "-", tone: "slate" as const };
}

function splitScope(value?: string | null) {
  return String(value ?? "")
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveScope(value: string | null | undefined, lookup: Map<string, string>) {
  const parts = splitScope(value);
  if (!parts.length) return "-";
  return parts.map((part) => lookup.get(part) ?? part).join("، ");
}

function inDateRange(value: Date, from: Date, to: Date) {
  return value >= from && value <= to;
}

function buildWhere(filters: UserManagementFilters) {
  const where: Record<string, unknown> = {};
  if (filters.role) where.role = filters.role;
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;
  if (filters.cityId) where.OR = [{ cityId: filters.cityId }, { driver: { cityId: filters.cityId } }, { supervisor: { cityId: filters.cityId } }];
  if (filters.supervisorId) where.OR = [{ supervisorId: filters.supervisorId }, { driver: { supervisorId: filters.supervisorId } }];
  if (filters.q) {
    const searchOr = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { driver: { name: { contains: filters.q, mode: "insensitive" } } },
      { supervisor: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
    where.AND = [{ OR: searchOr }];
  }
  return where;
}

export async function getUserManagementOldPageData(filters: UserManagementFilters): Promise<UserManagementData> {
  try {
    const from = new Date(`${filters.fromDate}T00:00:00.000Z`);
    const to = new Date(`${filters.toDate}T23:59:59.999Z`);

    const [users, cities, supervisors, drivers, projects, auditLogs, permissionSettings] = await Promise.all([
      prisma.user.findMany({
        where: buildWhere(filters),
        include: {
          city: true,
          driver: {
            include: {
              city: true,
              supervisor: true,
              applicationAccounts: {
                take: 1,
                orderBy: { updatedAt: "desc" },
                include: { applicationProject: { include: { application: true, city: true } } },
              },
            },
          },
          supervisor: { include: { city: true, drivers: { select: { id: true } } } },
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.city.findMany({ orderBy: { nameAr: "asc" } }),
      prisma.supervisor.findMany({ include: { city: true, users: true, drivers: { select: { id: true } } }, orderBy: { name: "asc" } }),
      prisma.driver.findMany({ select: { id: true, internalCode: true, name: true, cityId: true, supervisorId: true } }),
      prisma.applicationProject.findMany({
        include: { application: true, city: true },
        orderBy: [{ application: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.auditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.systemSetting.findMany({
        where: { key: { startsWith: USER_PERMISSION_PROFILE_PREFIX } },
        select: { key: true, value: true },
      }),
    ]);

    const cityLookup = new Map(cities.map((city) => [city.id, city.nameAr || city.nameEn || city.id]));
    const projectLookup = new Map(
      projects.map((project) => [
        project.id,
        project.name || `${project.application.name} - ${project.city?.nameAr || project.city?.nameEn || ""}`.trim(),
      ]),
    );
    const permissionProfiles = new Map(
      permissionSettings
        .map((setting) => [
          setting.key.slice(USER_PERMISSION_PROFILE_PREFIX.length),
          parseUserPermissionProfile(setting.value),
        ] as const)
        .filter((entry) => Boolean(entry[1])),
    );
    const auditByUser = new Map<string, Date>();
    for (const log of auditLogs) {
      if (log.userId && !auditByUser.has(log.userId)) auditByUser.set(log.userId, log.createdAt);
    }

    const q = filters.q.toLowerCase();
    const rows = users
      .map((user): UserManagementRow => {
        const status = displayStatus(user.status, user.isActive);
        const cityName = user.city?.nameAr || user.driver?.city?.nameAr || user.supervisor?.city?.nameAr || resolveScope(user.cityScope, cityLookup);
        const permissionProfile = permissionProfiles.get(user.id);
        const linkedApplicationProject = user.driver?.applicationAccounts[0]?.applicationProject;
        const projectScope = linkedApplicationProject?.name || resolveScope(user.projectScope, projectLookup);
        const supervisorName = user.supervisor?.name || user.driver?.supervisor?.name || "-";
        const scopedCityIds = new Set([user.cityId, user.driver?.cityId, user.supervisor?.cityId, ...splitScope(user.cityScope)].filter(Boolean) as string[]);
        const linkedDriversCount =
          user.role === "ADMIN"
            ? drivers.length
            : user.supervisorId
              ? drivers.filter((driver) => driver.supervisorId === user.supervisorId).length
              : scopedCityIds.size
                ? drivers.filter((driver) => driver.cityId && scopedCityIds.has(driver.cityId)).length
                : user.driverId
                  ? 1
                  : 0;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roleLabel: roleLabels[user.role] ?? user.role,
          status: user.status,
          statusLabel: status.label,
          statusTone: status.tone,
          lastLogin: displayDate(auditByUser.get(user.id)),
          device: "-",
          cityScope: cityName || "-",
          projectScope,
          supervisorName,
          linkedDriversCount,
          permissionsSummary: permissionProfile
            ? `${permissionProfile.labelAr} (${permissionProfile.permissions.length} صلاحية)`
            : permissionLabels[user.role] ?? "صلاحيات مخصصة",
          cityId: user.cityId || user.driver?.cityId || user.supervisor?.cityId || "",
          supervisorId: user.supervisorId || user.driver?.supervisorId || "",
          driverId: user.driverId || "",
          cityScopeRaw: user.cityScope || "",
          projectScopeRaw: user.projectScope || "",
          isActive: user.isActive,
        };
      })
      .filter((row) => {
        if (!q) return true;
        return [row.name, row.email, row.roleLabel, row.cityScope, row.supervisorName].some((value) => value.toLowerCase().includes(q));
      });

    const supervisorsWithoutUsers = supervisors.filter((supervisor) => supervisor.users.length === 0).length;
    const driversWithoutSupervisor = drivers.filter((driver) => !driver.supervisorId).length;
    const driversWithoutCity = drivers.filter((driver) => !driver.cityId).length;

    return {
      databaseStatus: "online",
      filters,
      roles: Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
      statuses: [
        { value: "active", label: "نشط" },
        { value: "inactive", label: "موقوف" },
      ],
      cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || city.id })),
      supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name, cityName: supervisor.city?.nameAr || "-", cityId: supervisor.cityId || "" })),
      drivers: drivers.map((driver) => ({ id: driver.id, name: driver.name, code: driver.internalCode, cityId: driver.cityId || "", supervisorId: driver.supervisorId || "" })),
      projects: projects.map((project) => ({ id: project.id, name: projectLookup.get(project.id) || project.name })),
      summary: {
        users: rows.length,
        active: rows.filter((row) => row.statusTone === "emerald").length,
        inactive: rows.filter((row) => row.statusTone !== "emerald").length,
        auditLogs: auditLogs.length,
      },
      scopeIssues: [
        {
          id: "supervisors-without-users",
          title: "مشرفين بدون مستخدم",
          value: supervisorsWithoutUsers,
          description: "مشرفين موجودين في التشغيل لكن ليس لهم حساب دخول.",
          tone: supervisorsWithoutUsers ? "amber" : "emerald",
        },
        {
          id: "drivers-without-supervisor",
          title: "مناديب بدون مشرف",
          value: driversWithoutSupervisor,
          description: "يجب ربطهم بمشرف لتفعيل نطاق الصلاحيات.",
          tone: driversWithoutSupervisor ? "red" : "emerald",
        },
        {
          id: "drivers-without-city",
          title: "مناديب بدون مدينة",
          value: driversWithoutCity,
          description: "نطاق المدينة غير مكتمل لهؤلاء المناديب.",
          tone: driversWithoutCity ? "red" : "emerald",
        },
      ],
      rows,
    };
  } catch (error) {
    return {
      databaseStatus: "offline",
      databaseMessage: error instanceof Error ? error.message : "Database is not available",
      filters,
      roles: Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
      statuses: [
        { value: "active", label: "نشط" },
        { value: "inactive", label: "موقوف" },
      ],
      cities: [],
      supervisors: [],
      drivers: [],
      projects: [],
      summary: { users: 0, active: 0, inactive: 0, auditLogs: 0 },
      scopeIssues: [],
      rows: [],
    };
  }
}
