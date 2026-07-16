import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSupervisorPermissionProfile,
  parseUserPermissionProfile,
  USER_PERMISSION_PROFILE_PREFIX,
} from "@/lib/auth/userPermissionProfile";

const validRoles = new Set(["ADMIN", "OPERATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "HR", "VIEWER"]);

export type UserManagementPayload = {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
  isActive?: unknown;
  cityId?: unknown;
  supervisorId?: unknown;
  driverId?: unknown;
  cityScope?: unknown;
  projectScope?: unknown;
  password?: unknown;
};

export function generateTemporaryPassword() {
  return `ERP-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const actual = Buffer.from(hash, "hex");
  const expected = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const clean = text(value);
  return clean || null;
}

function scopeToString(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(",");
  return text(value);
}

function normalizeStatus(status: unknown, isActive: unknown) {
  const raw = text(status).toLowerCase();
  const active = typeof isActive === "boolean" ? isActive : raw ? raw === "active" || raw === "نشط" : true;
  return {
    status: active ? "active" : "inactive",
    isActive: active,
  };
}

export function normalizeUserPayload(payload: UserManagementPayload, options?: { requirePassword?: boolean }) {
  const name = text(payload.name);
  const email = text(payload.email).toLowerCase();
  const role = text(payload.role).toUpperCase();
  const normalizedRole = validRoles.has(role) ? (role as Role) : ("VIEWER" as Role);
  const status = normalizeStatus(payload.status, payload.isActive);
  const password = text(payload.password);

  if (!name) throw new Error("اسم المستخدم مطلوب.");
  if (!email || !email.includes("@")) throw new Error("بريد المستخدم غير صحيح.");
  if (options?.requirePassword && !password) throw new Error("كلمة المرور مطلوبة.");

  return {
    data: {
      name,
      email,
      role: normalizedRole,
      status: status.status,
      isActive: status.isActive,
      cityId: optionalText(payload.cityId),
      supervisorId: optionalText(payload.supervisorId),
      driverId: optionalText(payload.driverId),
      cityScope: scopeToString(payload.cityScope),
      projectScope: scopeToString(payload.projectScope),
    },
    password,
  };
}

function safeUser(user: unknown) {
  if (!user || typeof user !== "object") return user;
  const { passwordHash: _passwordHash, ...rest } = user as Record<string, unknown>;
  return rest;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function syncManagedUserPermissionProfile(user: {
  id: string;
  email: string;
  role: Role;
  cityId: string | null;
  cityScope: string | null;
  projectScope: string | null;
}) {
  const key = `${USER_PERMISSION_PROFILE_PREFIX}${user.id}`;
  if (user.role === "SUPERVISOR") {
    const profile = buildSupervisorPermissionProfile(user);
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: jsonValue(profile), updatedBy: user.email },
      create: { key, value: jsonValue(profile), updatedBy: user.email },
    });
    return profile;
  }

  const existing = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
  const existingProfile = parseUserPermissionProfile(existing?.value);
  if (existingProfile && ["city_supervisor", "project_supervisor"].includes(existingProfile.profileKey)) {
    await prisma.systemSetting.delete({ where: { key } });
  }
  return null;
}

async function validateUserScopes(data: {
  role: Role;
  cityId: string | null;
  cityScope: string;
  projectScope: string;
}) {
  const cityIds = Array.from(new Set([data.cityId, ...data.cityScope.split(",")].map((item) => item?.trim()).filter(Boolean))) as string[];
  const applicationProjectIds = Array.from(new Set(data.projectScope.split(",").map((item) => item.trim()).filter(Boolean)));

  const [cityCount, projects] = await Promise.all([
    cityIds.length ? prisma.city.count({ where: { id: { in: cityIds } } }) : Promise.resolve(0),
    applicationProjectIds.length
      ? prisma.applicationProject.findMany({ where: { id: { in: applicationProjectIds } }, select: { id: true, cityId: true } })
      : Promise.resolve([]),
  ]);

  if (cityCount !== cityIds.length) throw new Error("نطاق المدن يحتوي على مدينة غير موجودة.");
  if (projects.length !== applicationProjectIds.length) {
    throw new Error("نطاق المشاريع يجب أن يحتوي على مشاريع تشغيلية من ApplicationProject فقط.");
  }
  if (data.role === "SUPERVISOR" && !cityIds.length) throw new Error("يجب تحديد مدينة للمشرف.");
  if (data.role === "SUPERVISOR" && applicationProjectIds.length && projects.some((project) => !project.cityId || !cityIds.includes(project.cityId))) {
    throw new Error("مشروع المشرف يجب أن يكون داخل المدينة المحددة لنفس الحساب.");
  }
}

export async function createManagedUser(payload: UserManagementPayload) {
  const normalized = normalizeUserPayload(payload);
  await validateUserScopes(normalized.data);
  const temporaryPassword = normalized.password || generateTemporaryPassword();
  try {
    const user = await prisma.user.create({
      data: {
        ...normalized.data,
        passwordHash: hashPassword(temporaryPassword),
      },
      include: { city: true, supervisor: true, driver: true },
    });

    await syncManagedUserPermissionProfile(user);

    await prisma.auditLog.create({
      data: {
        action: "USER_CREATE",
        entityType: "User",
        entityId: user.id,
        after: jsonValue(safeUser(user)),
        newValue: jsonValue(safeUser(user)),
      },
    });

    return { user: safeUser(user), temporaryPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("هذا البريد مستخدم بالفعل.");
    }
    throw error;
  }
}

export async function updateManagedUser(id: string, payload: UserManagementPayload) {
  const normalized = normalizeUserPayload(payload);
  await validateUserScopes(normalized.data);
  const before = await prisma.user.findUnique({ where: { id }, include: { city: true, supervisor: true, driver: true } });
  if (!before) throw new Error("المستخدم غير موجود.");

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...normalized.data,
        ...(normalized.password ? { passwordHash: hashPassword(normalized.password) } : {}),
      },
      include: { city: true, supervisor: true, driver: true },
    });

    await syncManagedUserPermissionProfile(user);

    await prisma.auditLog.create({
      data: {
        action: "USER_UPDATE",
        entityType: "User",
        entityId: user.id,
        before: jsonValue(safeUser(before)),
        after: jsonValue(safeUser(user)),
        oldValue: jsonValue(safeUser(before)),
        newValue: jsonValue(safeUser(user)),
      },
    });

    return { user: safeUser(user), passwordUpdated: Boolean(normalized.password) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("هذا البريد مستخدم بالفعل.");
    }
    throw error;
  }
}

export async function deactivateManagedUser(id: string) {
  const before = await prisma.user.findUnique({ where: { id }, include: { city: true, supervisor: true, driver: true } });
  if (!before) throw new Error("المستخدم غير موجود.");
  const user = await prisma.user.update({
    where: { id },
    data: { status: "inactive", isActive: false },
    include: { city: true, supervisor: true, driver: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_DEACTIVATE",
      entityType: "User",
      entityId: user.id,
      before: jsonValue(safeUser(before)),
      after: jsonValue(safeUser(user)),
      oldValue: jsonValue(safeUser(before)),
      newValue: jsonValue(safeUser(user)),
    },
  });

  return { user: safeUser(user) };
}

export async function resetManagedUserPassword(id: string) {
  const before = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, status: true, isActive: true } });
  if (!before) throw new Error("المستخدم غير موجود.");
  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(temporaryPassword) },
    select: { id: true, name: true, email: true, role: true, status: true, isActive: true, updatedAt: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: user.id,
      before: jsonValue(before),
      after: jsonValue(user),
      oldValue: jsonValue(before),
      newValue: jsonValue(user),
    },
  });

  return { user, temporaryPassword };
}
