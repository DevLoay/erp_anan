import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession, verifySessionToken, type SessionPayload } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/users/userManagementMutations";

function cookieValue(headers: Headers, name: string) {
  return headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

function normalizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function last4(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

async function loadDriverForSession(driverId: string) {
  return prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      city: { select: { id: true, nameAr: true, nameEn: true } },
      supervisor: { select: { id: true, name: true, phone: true } },
      applicationAccounts: {
        include: {
          application: { select: { id: true, name: true, code: true } },
          applicationProject: { select: { id: true, name: true, code: true, city: { select: { id: true, nameAr: true } } } },
          city: { select: { id: true, nameAr: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      vehicle: true,
      vehicleAssignments: {
        where: { status: RecordStatus.ACTIVE },
        include: { vehicle: true },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
  });
}

export type RiderSessionContext = {
  session: SessionPayload;
  driver: NonNullable<Awaited<ReturnType<typeof loadDriverForSession>>>;
};

export async function getRiderSession(headers: Headers): Promise<RiderSessionContext | null> {
  const token = cookieValue(headers, SESSION_COOKIE);
  const session = await verifySessionToken(token);
  if (!session) return null;

  let driverId = session.driverId || "";
  if (!driverId && session.userId) {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { driverId: true } });
    driverId = user?.driverId || "";
  }
  if (!driverId) return null;

  const driver = await loadDriverForSession(driverId);
  if (!driver || driver.status === "INACTIVE") return null;
  return { session: { ...session, driverId }, driver };
}

export async function authenticateRider(identifierInput: string, passwordInput: string) {
  const identifier = normalizeIdentifier(identifierInput);
  const password = String(passwordInput || "").trim();
  if (!identifier || !password) return { error: "رقم الجوال أو كود المندوب وكلمة المرور مطلوبان." };

  const lowered = identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: lowered }, { name: { equals: identifier, mode: "insensitive" } }],
      driverId: { not: null },
      isActive: true,
      status: { not: "inactive" },
    },
    include: { driver: true },
  });

  if (user?.driverId && user.passwordHash && verifyPassword(password, user.passwordHash)) {
    const token = await signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      driverId: user.driverId,
      phone: user.driver?.phone || user.driver?.mobile || undefined,
      cityId: user.driver?.cityId || undefined,
    });
    return { token, user, driver: user.driver };
  }

  const driver = await prisma.driver.findFirst({
    where: {
      OR: [
        { internalCode: { equals: identifier, mode: "insensitive" } },
        { driverCode: { equals: identifier, mode: "insensitive" } },
        { phone: identifier },
        { mobile: identifier },
        { nationalId: identifier },
      ],
      status: { not: "INACTIVE" },
    },
    include: { userAccounts: true },
  });
  if (!driver) return { error: "لم يتم العثور على مندوب بهذه البيانات." };

  const linkedUser = driver.userAccounts.find((account) => account.passwordHash && account.isActive && account.status !== "inactive");
  if (linkedUser?.passwordHash) {
    if (!verifyPassword(password, linkedUser.passwordHash)) return { error: "كلمة المرور غير صحيحة." };
    const token = await signSession({
      userId: linkedUser.id,
      email: linkedUser.email,
      name: linkedUser.name,
      role: linkedUser.role,
      driverId: driver.id,
      phone: driver.phone || driver.mobile || undefined,
      cityId: driver.cityId || undefined,
    });
    return { token, user: linkedUser, driver };
  }

  const acceptedFallbacks = new Set([
    driver.nationalId,
    last4(driver.phone),
    last4(driver.mobile),
    driver.driverCode,
    driver.internalCode,
  ].filter(Boolean).map((value) => String(value)));
  if (!acceptedFallbacks.has(password)) {
    return { error: "كلمة المرور غير صحيحة. استخدم حساب المستخدم المربوط أو آخر 4 أرقام من الجوال/رقم الهوية." };
  }

  const token = await signSession({
    userId: `driver:${driver.id}`,
    email: `${driver.id}@rider.local`,
    name: driver.actualName || driver.name,
    role: "VIEWER",
    driverId: driver.id,
    phone: driver.phone || driver.mobile || undefined,
    cityId: driver.cityId || undefined,
  });
  return { token, user: null, driver };
}

export async function auditRiderAction(driverId: string, action: string, entityType: string, entityId?: string | null, after?: unknown) {
  await prisma.auditLog
    .create({
      data: {
        user: `rider:${driverId}`,
        action,
        entityType,
        entityId: entityId || undefined,
        after: after == null ? undefined : JSON.parse(JSON.stringify(after)),
        newValue: after == null ? undefined : JSON.parse(JSON.stringify(after)),
      },
    })
    .catch(() => null);
}
