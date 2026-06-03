import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/auth/accessScope";
import { databaseOfflineMessage } from "@/lib/imports/templates";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function timeOnly(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function driverName(driver?: { actualName: string | null; name: string; internalCode: string; driverCode: string | null } | null) {
  if (!driver) return "-";
  return driver.actualName || driver.name || driver.internalCode || driver.driverCode || "-";
}

function cityName(city?: { nameAr: string; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "-";
}

function scopedDriverWhere(scope?: AccessScope): Prisma.DriverWhereInput {
  if (!scope || scope.isGlobal) return {};
  const and: Prisma.DriverWhereInput[] = [];
  if (scope.driverId) and.push({ id: scope.driverId });
  if (scope.supervisorId) and.push({ supervisorId: scope.supervisorId });
  if (scope.cityIds.length) and.push({ cityId: { in: scope.cityIds } });
  if (scope.projectIds.length) and.push({ projectId: { in: scope.projectIds } });
  return and.length ? { AND: and } : { id: "__NO_ACCESS__" };
}

function scopedSupervisorWhere(scope?: AccessScope): Prisma.SupervisorWhereInput {
  if (!scope || scope.isGlobal) return {};
  if (scope.supervisorId) return { id: scope.supervisorId };
  if (scope.cityIds.length) return { cityId: { in: scope.cityIds } };
  return { id: "__NO_ACCESS__" };
}

function scopedUserWhere(scope?: AccessScope): Prisma.UserWhereInput {
  if (!scope || scope.isGlobal) return {};
  return scope.userId ? { id: scope.userId } : { id: "__NO_ACCESS__" };
}

function scopedAttendanceWhere(scope?: AccessScope): Prisma.AttendanceRecordWhereInput {
  if (!scope || scope.isGlobal) return {};
  const or: Prisma.AttendanceRecordWhereInput[] = [];
  if (scope.driverId) or.push({ driverId: scope.driverId });
  if (scope.supervisorId) or.push({ OR: [{ supervisorId: scope.supervisorId }, { driver: { is: { supervisorId: scope.supervisorId } } }] });
  if (scope.userId) or.push({ userId: scope.userId });
  if (scope.cityIds.length) {
    or.push({ driver: { is: { cityId: { in: scope.cityIds } } } });
    or.push({ supervisor: { is: { cityId: { in: scope.cityIds } } } });
  }
  return or.length ? { OR: or } : { id: "__NO_ACCESS__" };
}

function statusLabel(record: { checkIn: Date | null; checkOut: Date | null; status: string }) {
  if (record.status === "REJECTED") return "غائب";
  if (record.checkIn && record.checkOut) return "مكتمل";
  if (record.checkIn) return "حاضر";
  if (record.checkOut) return "انصراف فقط";
  return "قيد المتابعة";
}

function statusTone(label: string) {
  if (label === "مكتمل" || label === "حاضر") return "green" as const;
  if (label === "انصراف فقط" || label === "قيد المتابعة") return "amber" as const;
  return "red" as const;
}

export type AttendanceFilters = {
  fromDate: string;
  toDate: string;
  workDate: string;
  q: string;
  personType: string;
  accessScope?: AccessScope;
};

export type AttendancePageData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: AttendanceFilters;
  people: {
    id: string;
    type: "driver" | "supervisor" | "user";
    label: string;
    subLabel: string;
    city: string;
  }[];
  summary: {
    total: number;
    present: number;
    completed: number;
    missingCheckOut: number;
    supervisors: number;
    drivers: number;
    withCheckInPhoto: number;
    withCheckOutPhoto: number;
  };
  rows: {
    id: string;
    personId: string;
    personType: "driver" | "supervisor" | "user";
    personName: string;
    personCode: string;
    city: string;
    project: string;
    supervisor: string;
    workDate: string;
    checkIn: string;
    checkOut: string;
    workingHours: number;
    statusLabel: string;
    statusTone: "green" | "amber" | "red";
    checkInPhoto: string;
    checkOutPhoto: string;
    notes: string;
  }[];
};

export function resolveAttendanceFilters(params: SearchParams, accessScope?: AccessScope): AttendanceFilters {
  const today = isoDate(new Date());
  const fromDate = one(params, "fromDate") || isoDate(addDays(new Date(), -30));
  return {
    fromDate,
    toDate: one(params, "toDate") || today,
    workDate: one(params, "workDate") || today,
    q: one(params, "q").trim(),
    personType: one(params, "personType"),
    accessScope,
  };
}

function emptyData(filters: AttendanceFilters, message?: string): AttendancePageData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    people: [],
    summary: { total: 0, present: 0, completed: 0, missingCheckOut: 0, supervisors: 0, drivers: 0, withCheckInPhoto: 0, withCheckOutPhoto: 0 },
    rows: [],
  };
}

export async function getAttendancePageData(filters: AttendanceFilters): Promise<AttendancePageData> {
  try {
    const dateWhere = { gte: startOfDay(filters.fromDate), lte: endOfDay(filters.toDate) };
    const q = filters.q.toLowerCase();
    const [records, drivers, supervisors, users] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          AND: [
            scopedAttendanceWhere(filters.accessScope),
            { workDate: dateWhere },
            filters.personType ? { personType: filters.personType } : {},
          ].filter((item) => Object.keys(item).length),
        },
        include: {
          driver: {
            select: {
              id: true,
              internalCode: true,
              driverCode: true,
              name: true,
              actualName: true,
              city: { select: { nameAr: true, nameEn: true } },
              project: { select: { name: true, appName: true } },
              supervisor: { select: { name: true } },
            },
          },
          supervisor: { select: { id: true, name: true, email: true, city: { select: { nameAr: true, nameEn: true } } } },
          user: { select: { id: true, name: true, email: true, role: true, city: { select: { nameAr: true, nameEn: true } } } },
        },
        orderBy: [{ workDate: "desc" }, { updatedAt: "desc" }],
        take: 700,
      }),
      prisma.driver.findMany({
        where: scopedDriverWhere(filters.accessScope),
        select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
        take: 800,
      }),
      prisma.supervisor.findMany({
        where: scopedSupervisorWhere(filters.accessScope),
        select: { id: true, name: true, email: true, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
        take: 300,
      }),
      prisma.user.findMany({
        where: scopedUserWhere(filters.accessScope),
        select: { id: true, name: true, email: true, role: true, city: { select: { nameAr: true, nameEn: true } } },
        orderBy: { name: "asc" },
        take: 300,
      }),
    ]);

    const people = [
      ...drivers.map((driver) => ({
        id: driver.id,
        type: "driver" as const,
        label: driverName(driver),
        subLabel: driver.internalCode || driver.driverCode || "مندوب",
        city: cityName(driver.city),
      })),
      ...supervisors.map((supervisor) => ({
        id: supervisor.id,
        type: "supervisor" as const,
        label: supervisor.name,
        subLabel: supervisor.email || "مشرف",
        city: cityName(supervisor.city),
      })),
      ...users.map((user) => ({
        id: user.id,
        type: "user" as const,
        label: user.name,
        subLabel: user.email || user.role,
        city: cityName(user.city),
      })),
    ].filter((person) => {
      if (!q) return true;
      return `${person.label} ${person.subLabel} ${person.city}`.toLowerCase().includes(q);
    });

    const rows = records
      .map((record) => {
        const personType = (record.personType || (record.driverId ? "driver" : record.supervisorId ? "supervisor" : "user")) as "driver" | "supervisor" | "user";
        const label = statusLabel(record);
        const personName =
          personType === "driver" ? driverName(record.driver) : personType === "supervisor" ? record.supervisor?.name || "-" : record.user?.name || "-";
        const personCode =
          personType === "driver"
            ? record.driver?.internalCode || record.driver?.driverCode || "-"
            : personType === "supervisor"
              ? record.supervisor?.email || "-"
              : record.user?.email || "-";
        const city =
          personType === "driver" ? cityName(record.driver?.city) : personType === "supervisor" ? cityName(record.supervisor?.city) : cityName(record.user?.city);

        return {
          id: record.id,
          personId: record.driverId || record.supervisorId || record.userId || "",
          personType,
          personName,
          personCode,
          city,
          project: record.driver?.project?.name || record.driver?.project?.appName || "-",
          supervisor: record.driver?.supervisor?.name || (personType === "supervisor" ? personName : "-"),
          workDate: isoDate(record.workDate),
          checkIn: timeOnly(record.checkIn),
          checkOut: timeOnly(record.checkOut),
          workingHours: Math.round(numberValue(record.workingHours) * 10) / 10,
          statusLabel: label,
          statusTone: statusTone(label),
          checkInPhoto: record.checkInPhoto || "",
          checkOutPhoto: record.checkOutPhoto || "",
          notes: record.notes || "",
        };
      })
      .filter((row) => {
        if (!q) return true;
        return `${row.personName} ${row.personCode} ${row.city} ${row.project} ${row.supervisor}`.toLowerCase().includes(q);
      });

    return {
      databaseStatus: "online",
      filters,
      people,
      summary: {
        total: rows.length,
        present: rows.filter((row) => row.checkIn !== "-").length,
        completed: rows.filter((row) => row.checkIn !== "-" && row.checkOut !== "-").length,
        missingCheckOut: rows.filter((row) => row.checkIn !== "-" && row.checkOut === "-").length,
        supervisors: rows.filter((row) => row.personType === "supervisor").length,
        drivers: rows.filter((row) => row.personType === "driver").length,
        withCheckInPhoto: rows.filter((row) => row.checkInPhoto).length,
        withCheckOutPhoto: rows.filter((row) => row.checkOutPhoto).length,
      },
      rows,
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}
