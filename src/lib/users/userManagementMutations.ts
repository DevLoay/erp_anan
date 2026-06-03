import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function createManagedUser(payload: UserManagementPayload) {
  const normalized = normalizeUserPayload(payload);
  const temporaryPassword = normalized.password || generateTemporaryPassword();
  try {
    const user = await prisma.user.create({
      data: {
        ...normalized.data,
        passwordHash: hashPassword(temporaryPassword),
      },
      include: { city: true, supervisor: true, driver: true },
    });

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
  const before = await prisma.user.findUnique({ where: { id }, include: { city: true, supervisor: true, driver: true } });
  if (!before) throw new Error("المستخدم غير موجود.");

  try {
    const user = await prisma.user.update({
      where: { id },
      data: normalized.data,
      include: { city: true, supervisor: true, driver: true },
    });

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

    return { user: safeUser(user) };
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
