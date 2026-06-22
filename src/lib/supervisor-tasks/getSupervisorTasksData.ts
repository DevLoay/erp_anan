import { Prisma } from "@prisma/client";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;

export type SupervisorTaskStatusKey = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "OVERDUE";
export type SupervisorTaskPriority = "INFO" | "WARNING" | "CRITICAL";

export type SupervisorTaskRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  cityId: string;
  cityName: string;
  supervisorId: string;
  supervisorName: string;
  driverId: string;
  driverName: string;
  priority: SupervisorTaskPriority;
  priorityLabel: string;
  status: string;
  statusKey: SupervisorTaskStatusKey;
  statusLabel: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  isOverdue: boolean;
};

export type SupervisorTasksData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  forbidden?: boolean;
  filters: {
    cityId: string;
    supervisorId: string;
    status: string;
    priority: string;
    from: string;
    to: string;
    q: string;
  };
  access: {
    role: string;
    canCreate: boolean;
    canManage: boolean;
    canUpdateOwn: boolean;
    supervisorId: string;
  };
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    highPriority: number;
  };
  rows: SupervisorTaskRow[];
  options: {
    cities: { id: string; name: string }[];
    supervisors: { id: string; name: string; cityId: string }[];
    drivers: { id: string; name: string; cityId: string; supervisorId: string }[];
  };
};

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return isoDate(date);
}

function parseDate(value: string, fallback: string) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function displayDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function displayDateTime(value: Date) {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function cityLabel(city?: { nameAr: string; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "-";
}

function driverLabel(driver?: { actualName: string | null; name: string; internalCode: string } | null) {
  if (!driver) return "-";
  return driver.actualName || driver.name || driver.internalCode;
}

export function resolveSupervisorTaskFilters(params: SearchParams): SupervisorTasksData["filters"] {
  const today = isoDate(new Date());
  return {
    cityId: one(params, "cityId"),
    supervisorId: one(params, "supervisorId"),
    status: one(params, "status"),
    priority: one(params, "priority"),
    from: one(params, "from") || defaultFrom(),
    to: one(params, "to") || today,
    q: one(params, "q"),
  };
}

function priorityLabel(priority: string) {
  if (priority === "CRITICAL") return "عاجل";
  if (priority === "WARNING") return "مهم";
  return "عادي";
}

function statusKey(status: string, dueDate?: Date | null): SupervisorTaskStatusKey {
  const value = status.toUpperCase();
  const isClosed = ["APPROVED", "LOCKED", "CANCELLED", "REJECTED", "INACTIVE"].includes(value);
  if (!isClosed && dueDate && dueDate.getTime() < Date.now()) return "OVERDUE";
  if (value === "ACTIVE") return "IN_PROGRESS";
  if (value === "APPROVED" || value === "LOCKED") return "COMPLETED";
  if (value === "CANCELLED" || value === "REJECTED" || value === "INACTIVE") return "CANCELLED";
  return "PENDING";
}

function statusLabel(key: SupervisorTaskStatusKey) {
  if (key === "IN_PROGRESS") return "قيد التنفيذ";
  if (key === "COMPLETED") return "مكتملة";
  if (key === "CANCELLED") return "ملغاة";
  if (key === "OVERDUE") return "متأخرة";
  return "قيد الانتظار";
}

function dbStatus(input: string) {
  const value = input.toUpperCase();
  if (value === "IN_PROGRESS") return "ACTIVE";
  if (value === "COMPLETED") return "APPROVED";
  if (value === "CANCELLED") return "CANCELLED";
  if (["PENDING", "ACTIVE", "APPROVED", "LOCKED", "REJECTED", "INACTIVE"].includes(value)) return value;
  return "";
}

function scopedTaskWhere(scope: AccessScope): Prisma.TaskWhereInput {
  if (scope.isGlobal) return {};
  const clauses: Prisma.TaskWhereInput[] = [];
  if (scope.supervisorId) clauses.push({ supervisorId: scope.supervisorId });
  if (scope.driverId) clauses.push({ driverId: scope.driverId });
  if (scope.cityIds.length) clauses.push({ cityId: { in: scope.cityIds } });
  return clauses.length ? { OR: clauses } : { id: "__NO_ACCESS_SCOPE__" };
}

function scopedCityWhere(scope: AccessScope): Prisma.CityWhereInput {
  return scope.isGlobal || !scope.cityIds.length ? {} : { id: { in: scope.cityIds } };
}

function scopedSupervisorWhere(scope: AccessScope): Prisma.SupervisorWhereInput {
  if (scope.isGlobal) return {};
  if (scope.supervisorId) return { id: scope.supervisorId };
  if (scope.cityIds.length) return { cityId: { in: scope.cityIds } };
  return { id: "__NO_ACCESS_SCOPE__" };
}

function scopedDriverWhere(scope: AccessScope): Prisma.DriverWhereInput {
  if (scope.isGlobal) return {};
  const clauses: Prisma.DriverWhereInput[] = [];
  if (scope.driverId) clauses.push({ id: scope.driverId });
  if (scope.supervisorId) clauses.push({ supervisorId: scope.supervisorId });
  if (scope.cityIds.length) clauses.push({ cityId: { in: scope.cityIds } });
  return clauses.length ? { OR: clauses } : { id: "__NO_ACCESS_SCOPE__" };
}

function emptyData(filters: SupervisorTasksData["filters"], message?: string, forbidden = false): SupervisorTasksData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    forbidden,
    filters,
    access: { role: "VIEWER", canCreate: false, canManage: false, canUpdateOwn: false, supervisorId: "" },
    summary: { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, highPriority: 0 },
    rows: [],
    options: { cities: [], supervisors: [], drivers: [] },
  };
}

export async function getSupervisorTasksData(filters: SupervisorTasksData["filters"], requestHeaders: Headers): Promise<SupervisorTasksData> {
  const role = roleFromHeaders(requestHeaders);
  if (!canReadResource(role, "tasks")) return emptyData(filters, undefined, true);
  const scope = await getAccessScope(requestHeaders);

  const from = parseDate(filters.from, defaultFrom());
  const to = endOfDay(parseDate(filters.to, isoDate(new Date())));
  const q = filters.q.trim();
  const status = dbStatus(filters.status);

  const and: Prisma.TaskWhereInput[] = [
    scopedTaskWhere(scope),
    {
      OR: [
        { dueDate: { gte: from, lte: to } },
        { dueDate: null, createdAt: { gte: from, lte: to } },
      ],
    },
  ];

  if (filters.cityId) and.push({ cityId: filters.cityId });
  if (filters.supervisorId) and.push({ supervisorId: filters.supervisorId });
  if (filters.priority) and.push({ priority: filters.priority as Prisma.EnumSeverityFilter["equals"] });
  if (status) and.push({ status: status as Prisma.EnumRecordStatusFilter["equals"] });
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { supervisor: { is: { name: { contains: q, mode: "insensitive" } } } },
        { driver: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { actualName: { contains: q, mode: "insensitive" } }, { internalCode: { contains: q, mode: "insensitive" } }] } } },
      ],
    });
  }

  try {
    const [tasks, cities, supervisors, drivers] = await Promise.all([
      prisma.task.findMany({
        where: { AND: and },
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          supervisor: { select: { id: true, name: true, cityId: true } },
          driver: { select: { id: true, internalCode: true, name: true, actualName: true, cityId: true, supervisorId: true } },
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        take: 500,
      }),
      prisma.city.findMany({ where: scopedCityWhere(scope), select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
      prisma.supervisor.findMany({ where: scopedSupervisorWhere(scope), select: { id: true, name: true, cityId: true }, orderBy: { name: "asc" } }),
      prisma.driver.findMany({ where: scopedDriverWhere(scope), select: { id: true, internalCode: true, name: true, actualName: true, cityId: true, supervisorId: true }, orderBy: { name: "asc" }, take: 1000 }),
    ]);

    const rows = tasks.map((task): SupervisorTaskRow => {
      const key = statusKey(task.status, task.dueDate);
      return {
        id: task.id,
        title: task.title,
        description: task.description || "",
        category: task.category || "",
        cityId: task.cityId || "",
        cityName: cityLabel(task.city),
        supervisorId: task.supervisorId || "",
        supervisorName: task.supervisor?.name || "-",
        driverId: task.driverId || "",
        driverName: driverLabel(task.driver),
        priority: task.priority,
        priorityLabel: priorityLabel(task.priority),
        status: task.status,
        statusKey: key,
        statusLabel: statusLabel(key),
        dueDate: displayDate(task.dueDate),
        createdAt: displayDateTime(task.createdAt),
        updatedAt: displayDateTime(task.updatedAt),
        notes: task.notes || "",
        isOverdue: key === "OVERDUE",
      };
    });

    return {
      databaseStatus: "online",
      filters,
      access: {
        role,
        canCreate: role === "ADMIN" || role === "OPERATION_MANAGER",
        canManage: role === "ADMIN" || role === "OPERATION_MANAGER",
        canUpdateOwn: role === "SUPERVISOR",
        supervisorId: scope.supervisorId,
      },
      summary: {
        total: rows.length,
        pending: rows.filter((row) => row.statusKey === "PENDING").length,
        inProgress: rows.filter((row) => row.statusKey === "IN_PROGRESS").length,
        completed: rows.filter((row) => row.statusKey === "COMPLETED").length,
        overdue: rows.filter((row) => row.statusKey === "OVERDUE").length,
        highPriority: rows.filter((row) => row.priority === "CRITICAL").length,
      },
      rows,
      options: {
        cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || city.id })),
        supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name, cityId: supervisor.cityId || "" })),
        drivers: drivers.map((driver) => ({ id: driver.id, name: `${driver.actualName || driver.name} - ${driver.internalCode}`, cityId: driver.cityId || "", supervisorId: driver.supervisorId || "" })),
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}
