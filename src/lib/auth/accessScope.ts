import { type User } from "@prisma/client";
import { roleFromHeaders, type AppRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type AccessScope = {
  role: AppRole;
  userId: string;
  isGlobal: boolean;
  cityIds: string[];
  projectIds: string[];
  supervisorId: string;
  driverId: string;
};

const globalScope: AccessScope = {
  role: "ADMIN",
  userId: "",
  isGlobal: true,
  cityIds: [],
  projectIds: [],
  supervisorId: "",
  driverId: "",
};

function splitScope(value?: string | null) {
  return String(value ?? "")
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function headerValue(headers: Headers, key: string) {
  return headers.get(key) || headers.get(key.toLowerCase()) || "";
}

function cookieValue(headers: Headers, key: string) {
  const cookie = headers.get("cookie") || "";
  const found = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));
  return found ? decodeURIComponent(found.slice(key.length + 1)) : "";
}

async function findUserFromHeaders(headers: Headers) {
  const userId = headerValue(headers, "x-user-id") || cookieValue(headers, "erp-user-id");
  const email = headerValue(headers, "x-user-email") || cookieValue(headers, "erp-user-email");

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true, supervisor: true },
    });
    if (user) return user;
  }

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { driver: true, supervisor: true },
    });
    if (user) return user;
  }

  return null;
}

export async function getAccessScope(headers: Headers): Promise<AccessScope> {
  const headerRole = roleFromHeaders(headers);
  const user = await findUserFromHeaders(headers).catch(() => null);
  if (!user) {
    if (headerRole === "ADMIN" || headerRole === "OPERATION_MANAGER") return { ...globalScope, role: headerRole };
    return { role: headerRole, userId: "", isGlobal: false, cityIds: [], projectIds: [], supervisorId: "", driverId: "" };
  }

  return scopeFromUser(user);
}

export function scopeFromUser(user: User & { driver?: { cityId: string | null; projectId: string | null; supervisorId: string | null } | null; supervisor?: { cityId: string | null } | null }): AccessScope {
  const role = user.role as AppRole;
  if (role === "ADMIN" || role === "OPERATION_MANAGER") {
    return { ...globalScope, role, userId: user.id };
  }

  const supervisorId = user.supervisorId || user.driver?.supervisorId || "";
  const driverId = user.driverId || "";
  const cityIds = unique([user.cityId, user.driver?.cityId, user.supervisor?.cityId, ...splitScope(user.cityScope)]);
  const projectIds = unique([user.driver?.projectId, ...splitScope(user.projectScope)]);

  return {
    role,
    userId: user.id,
    isGlobal: false,
    cityIds,
    projectIds,
    supervisorId,
    driverId,
  };
}

export function canAccessCity(scope: AccessScope, cityId: string) {
  return scope.isGlobal || !scope.cityIds.length || scope.cityIds.includes(cityId);
}

export function canAccessProject(scope: AccessScope, projectId: string) {
  return scope.isGlobal || !scope.projectIds.length || scope.projectIds.includes(projectId);
}

export function scopeLabel(scope: AccessScope) {
  if (scope.isGlobal) return "كل البيانات";
  if (scope.supervisorId) return "نطاق مشرف";
  if (scope.cityIds.length) return "نطاق مدينة";
  if (scope.driverId) return "نطاق مندوب";
  return "لا يوجد نطاق بيانات";
}
